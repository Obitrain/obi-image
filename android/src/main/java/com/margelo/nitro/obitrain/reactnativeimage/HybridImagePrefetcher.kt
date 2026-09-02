package com.margelo.nitro.obitrain.reactnativeimage

import coil3.decode.BlackholeDecoder
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

@DoNotStrip
class HybridImagePrefetcher : HybridImagePrefetcherSpec() {
  override fun prefetch(urls: Array<String>): Promise<Unit> = Promise.async {
    val context = NitroModules.applicationContext ?: return@async
    val loader = ImageLoaders.get(context)
    coroutineScope {
      urls.map { url ->
        async {
          // Fill the disk cache only: no decode, no memory-cache entry.
          val request = ImageRequest.Builder(context)
            .data(url)
            .memoryCachePolicy(CachePolicy.DISABLED)
            .decoderFactory(BlackholeDecoder.Factory())
            .build()
          runCatching { loader.execute(request) }
        }
      }.awaitAll()
    }
  }
}
