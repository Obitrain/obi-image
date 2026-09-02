import Foundation
import Kingfisher
import NitroModules

final class HybridImagePrefetcher: HybridImagePrefetcherSpec {
  private var active: [ImagePrefetcher] = []

  func prefetch(urls: [String]) throws -> Promise<Void> {
    let promise = Promise<Void>()
    let list = urls.compactMap { URL(string: $0) }
    guard !list.isEmpty else { promise.resolve(withResult: ()); return promise }
    DispatchQueue.main.async {
      // No processor: caches the ORIGINAL bytes, which is exactly what the view's .cacheOriginalImage path reads.
      var prefetcher: ImagePrefetcher! = nil
      prefetcher = ImagePrefetcher(urls: list, options: [.scaleFactor(1)]) { [weak self] _, _, _ in
        promise.resolve(withResult: ())
        if let p = prefetcher { self?.active.removeAll { $0 === p } }
      }
      self.active.append(prefetcher)
      prefetcher.start()
    }
    return promise
  }
}
