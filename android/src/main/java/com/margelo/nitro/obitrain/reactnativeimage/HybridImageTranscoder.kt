package com.margelo.nitro.obitrain.reactnativeimage

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import androidx.annotation.Keep
import coil3.request.CachePolicy
import coil3.request.ErrorResult
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.request.allowRgb565
import coil3.size.Precision
import coil3.size.Scale
import coil3.toBitmap
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.io.File
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Keep
@DoNotStrip
class HybridImageTranscoder @DoNotStrip constructor() : HybridImageTranscoderSpec() {
  override fun transcode(uri: String, options: TranscodeOptions): Promise<TranscodedImage> = Promise.async {
    val context = NitroModules.applicationContext ?: throw Error("No application context")
    val maxSize = options.maxSize.toInt()
    // Coil resolves content://, file:// and http(s), applies EXIF orientation and decodes HEIC on API 28+.
    val request = ImageRequest.Builder(context)
      .data(uri)
      .size(maxSize)
      .scale(Scale.FIT)
      .precision(Precision.INEXACT)
      .allowHardware(false)
      .allowRgb565(false)
      .memoryCachePolicy(CachePolicy.DISABLED)
      .diskCachePolicy(CachePolicy.DISABLED)
      .build()
    val bitmap = when (val result = ImageLoaders.get(context).execute(request)) {
      is SuccessResult -> result.image.toBitmap()
      is ErrorResult -> throw Error("Could not decode $uri", result.throwable)
    }
    withContext(Dispatchers.IO) {
      val output = opaque(fit(bitmap, maxSize))
      val file = File(context.cacheDir, "transcode-${UUID.randomUUID()}.jpg")
      // A fresh bitmap carries no EXIF/GPS metadata.
      file.outputStream().use { output.compress(Bitmap.CompressFormat.JPEG, (options.quality * 100).roundToInt(), it) }
      TranscodedImage(Uri.fromFile(file).toString(), output.width.toDouble(), output.height.toDouble(), file.length().toDouble())
    }
  }

  /** Coil's inexact decode can land above the target (power-of-two sampling): finish the downscale. */
  private fun fit(bitmap: Bitmap, maxSize: Int): Bitmap {
    val longest = max(bitmap.width, bitmap.height)
    if (longest <= maxSize) return bitmap
    val ratio = maxSize.toDouble() / longest
    return Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).roundToInt(), (bitmap.height * ratio).roundToInt(), true)
  }

  /** JPEG has no alpha: flatten transparent pixels onto white instead of black. */
  private fun opaque(bitmap: Bitmap): Bitmap {
    if (!bitmap.hasAlpha()) return bitmap
    val flattened = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
    Canvas(flattened).apply {
      drawColor(Color.WHITE)
      drawBitmap(bitmap, 0f, 0f, null)
    }
    return flattened
  }
}
