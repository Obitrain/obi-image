package com.margelo.nitro.obitrain.reactnativeimage

import android.content.Context
import android.os.Build
import coil3.ImageLoader
import coil3.request.allowRgb565
import coil3.disk.DiskCache
import coil3.disk.directory
import coil3.gif.AnimatedImageDecoder
import coil3.gif.GifDecoder
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory

/** Library-owned Coil loader (never the app singleton), one per process. */
object ImageLoaders {
  @Volatile private var loader: ImageLoader? = null

  fun get(context: Context): ImageLoader =
    loader ?: synchronized(this) { loader ?: build(context.applicationContext).also { loader = it } }

  private fun build(app: Context): ImageLoader =
    ImageLoader.Builder(app)
      .memoryCache { MemoryCache.Builder().maxSizePercent(app, 0.10).build() } // decoded-to-size thumbs are small; 10% is plenty
      .allowRgb565(true) // opaque JPEGs decode to 16-bit: half the bitmap memory, no visible loss for thumbs
      .diskCache {
        DiskCache.Builder()
          .directory(app.cacheDir.resolve("obitrain_image_cache"))
          .maxSizeBytes(256L * 1024 * 1024)
          .build()
      }
      .components {
        add(OkHttpNetworkFetcherFactory())
        if (Build.VERSION.SDK_INT >= 28) add(AnimatedImageDecoder.Factory()) else add(GifDecoder.Factory())
      }
      .build()
}
