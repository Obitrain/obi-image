import Foundation
import ImageIO
import NitroModules
import Photos
import UniformTypeIdentifiers

struct TranscodeError: LocalizedError {
  let errorDescription: String?
  init(_ message: String) { errorDescription = message }
}

final class HybridImageTranscoder: HybridImageTranscoderSpec {
  func transcode(uri: String, options: TranscodeOptions) throws -> Promise<TranscodedImage> {
    return Promise.async {
      let data = try await Self.load(uri)
      return try Self.encode(data, options)
    }
  }

  private static func load(_ uri: String) async throws -> Data {
    if uri.hasPrefix("ph://") { return try await loadAsset(String(uri.dropFirst("ph://".count))) }
    let url = uri.hasPrefix("/") ? URL(fileURLWithPath: uri) : URL(string: uri)
    guard let url else { throw TranscodeError("Invalid URI: \(uri)") }
    if url.isFileURL { return try Data(contentsOf: url) }
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
  }

  /// Current version of a Photos asset (edits included), downloaded from iCloud if needed.
  private static func loadAsset(_ localIdentifier: String) async throws -> Data {
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil).firstObject else {
      throw TranscodeError("Photo not found: \(localIdentifier)")
    }
    let options = PHImageRequestOptions()
    options.isNetworkAccessAllowed = true
    options.deliveryMode = .highQualityFormat
    options.version = .current
    return try await withCheckedThrowingContinuation { continuation in
      PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, info in
        if let data { return continuation.resume(returning: data) }
        let error = info?[PHImageErrorKey] as? Error
        continuation.resume(throwing: error ?? TranscodeError("Could not load photo \(localIdentifier)"))
      }
    }
  }

  private static func encode(_ data: Data, _ options: TranscodeOptions) throws -> TranscodedImage {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int
    else { throw TranscodeError("Unsupported image") }

    // Decodes straight at the target size and applies the EXIF orientation; never upscales.
    let thumbnailOptions: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: min(Int(options.maxSize), max(width, height)),
    ]
    guard let decoded = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions as CFDictionary) else {
      throw TranscodeError("Could not decode image")
    }
    let image = try opaque(decoded)

    let url = FileManager.default.temporaryDirectory.appendingPathComponent("transcode-\(UUID().uuidString).jpg")
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
    else { throw TranscodeError("Could not create \(url.path)") }
    // No metadata is copied, so EXIF/GPS never leaves the device.
    CGImageDestinationAddImage(
      destination, image, [kCGImageDestinationLossyCompressionQuality: options.quality] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw TranscodeError("Could not write JPEG") }

    let size = (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.doubleValue ?? 0
    return TranscodedImage(uri: url.absoluteString, width: Double(image.width), height: Double(image.height), size: size)
  }

  /// JPEG has no alpha: flatten transparent pixels onto white instead of black.
  private static func opaque(_ image: CGImage) throws -> CGImage {
    switch image.alphaInfo {
    case .none, .noneSkipFirst, .noneSkipLast: return image
    default: break
    }
    guard let context = CGContext(
      data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else { throw TranscodeError("Could not flatten image") }
    let rect = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(rect)
    context.draw(image, in: rect)
    guard let flattened = context.makeImage() else { throw TranscodeError("Could not flatten image") }
    return flattened
  }
}
