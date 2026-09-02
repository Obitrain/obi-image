import Foundation
import UIKit
import Kingfisher
import NitroModules

/// Keeps processed (downsampled) images out of the disk cache: nothing to encode, nothing to write.
private struct MemoryOnlySerializer: CacheSerializer {
  func data(with image: KFCrossPlatformImage, original: Data?) -> Data? { nil }
  func image(with data: Data, options: KingfisherParsedOptionsInfo) -> KFCrossPlatformImage? { nil }
}

final class HybridImageView: HybridObitrainImageViewSpec, RecyclableView {
  let view: UIImageView = {
    let v = UIImageView()
    v.clipsToBounds = true
    v.isUserInteractionEnabled = false
    v.contentMode = .scaleAspectFill
    return v
  }()

  var uri: String? = nil
  var resource: String? = nil
  var resizeMode: NativeResizeMode? = nil
  var tintColor: Double? = nil
  var decodeWidth: Double? = nil
  var decodeHeight: Double? = nil
  var recyclingKey: String? = nil
  var onError: ((String) -> Void)? = nil

  private var loadedKey: String? = nil
  private var lastRecyclingKey: String? = nil


  // Kingfisher's `kf` API is @MainActor; Nitro may set props off-main.
  private func onMain(_ body: @escaping @MainActor () -> Void) {
    if Thread.isMainThread { MainActor.assumeIsolated { body() } } else { Task { @MainActor in body() } }
  }

  // Props arrive as one batch; load once per batch.
  func afterUpdate() {
    onMain { self.apply() }
  }

  @MainActor private func apply() {
    view.contentMode = contentMode(for: resizeMode ?? .cover)
    if recyclingKey != lastRecyclingKey {
      lastRecyclingKey = recyclingKey
      view.image = nil
      loadedKey = nil
    }
    let w = Int(decodeWidth ?? 0), h = Int(decodeHeight ?? 0)
    guard w > 0, h > 0 else { return } // not laid out yet
    let key = "\(uri ?? "")|\(resource ?? "")|\(w)x\(h)"
    if key != loadedKey {
      loadedKey = key
      load(w: w, h: h)
    }
    applyTint()
  }

  @MainActor private func load(w: Int, h: Int) {
    view.kf.cancelDownloadTask()
    if let name = resource, !name.isEmpty {
      view.image = UIImage(named: name)
      if view.image == nil { onError?("Bundled image not found: \(name)") }
      return
    }
    guard let s = uri, let url = URL(string: s) else { view.image = nil; return }
    // Kingfisher decodes to kCGImageSourceThumbnailMaxPixelSize = max(size) * scaleFactor.
    // JS sends pixels, so scaleFactor(1). cover gets headroom for non-matching aspect ratios.
    let headroom = (resizeMode ?? .cover) == .cover ? 1.25 : 1.0 // cover: shorter side must still fill the view
    let maxPx = CGFloat(Double(max(w, h)) * headroom)
    // ImageIO thumbnails are already decoded bitmaps, so no .backgroundDecode (it would redraw them).
    // The downsampled result stays in the memory cache only (serializer returns no data → no JPEG re-encode,
    // no disk write); the original bytes go to disk via .cacheOriginalImage so a new size never re-downloads.
    // (.cacheMemoryOnly + .cacheOriginalImage trips a Kingfisher fatalError in CacheCallbackCoordinator.)
    let options: KingfisherOptionsInfo = [
      .processor(DownsamplingImageProcessor(size: CGSize(width: maxPx, height: maxPx))),
      .scaleFactor(1),
      .cacheOriginalImage,
      .cacheSerializer(MemoryOnlySerializer()),
      .keepCurrentImageWhileLoading, // one layer commit per load instead of two (nil placeholder, then image)
    ]
    let source: Source = url.isFileURL
      ? .provider(LocalFileImageDataProvider(fileURL: url))
      : .network(url)
    view.kf.setImage(with: source, placeholder: nil, options: options) { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(let r):
        self.applyTint()
      case .failure(let e):
        if !e.isTaskCancelled { self.onError?(e.localizedDescription) }
      }
    }
  }

  @MainActor private func applyTint() {
    guard let image = view.image else { return }
    if let t = tintColor {
      view.tintColor = Self.color(argb: t)
      if image.renderingMode != .alwaysTemplate { view.image = image.withRenderingMode(.alwaysTemplate) }
    } else if image.renderingMode == .alwaysTemplate {
      view.image = image.withRenderingMode(.alwaysOriginal)
    }
  }

  private func contentMode(for mode: NativeResizeMode) -> UIView.ContentMode {
    switch mode {
    case .cover: return .scaleAspectFill
    case .contain: return .scaleAspectFit
    case .stretch: return .scaleToFill
    case .center: return .center
    }
  }

  private static func color(argb: Double) -> UIColor {
    let v = UInt32(truncatingIfNeeded: Int64(argb))
    return UIColor(
      red: CGFloat((v >> 16) & 0xff) / 255,
      green: CGFloat((v >> 8) & 0xff) / 255,
      blue: CGFloat(v & 0xff) / 255,
      alpha: CGFloat((v >> 24) & 0xff) / 255)
  }

  func onDropView() {
    onMain { self.view.kf.cancelDownloadTask() }
  }

  // Reset everything: props are only re-applied on a recycled view if the next consumer sets them.
  func prepareForRecycle() {
    onMain { self.view.kf.cancelDownloadTask() }
    view.image = nil
    uri = nil; resource = nil; resizeMode = nil; tintColor = nil
    decodeWidth = nil; decodeHeight = nil; recyclingKey = nil; onError = nil
    loadedKey = nil; lastRecyclingKey = nil
  }
}
