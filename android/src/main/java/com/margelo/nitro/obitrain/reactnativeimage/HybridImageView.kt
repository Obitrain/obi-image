package com.margelo.nitro.obitrain.reactnativeimage

import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.widget.ImageView
import androidx.appcompat.widget.AppCompatImageView
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.target
import coil3.size.Precision
import coil3.util.CoilUtils
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.views.RecyclableView

@DoNotStrip
class HybridImageView(val context: ThemedReactContext) : HybridObitrainImageViewSpec(), RecyclableView {
  // The request target must be the ImageView itself so Coil sizes with Precision.INEXACT.
  override val view: AppCompatImageView = AppCompatImageView(context).apply {
    scaleType = ImageView.ScaleType.CENTER_CROP
    isClickable = false
    isFocusable = false
  }

  override var uri: String? = null
  override var resource: String? = null
  override var resizeMode: NativeResizeMode? = null
  override var tintColor: Double? = null
  override var decodeWidth: Double? = null
  override var decodeHeight: Double? = null
  override var recyclingKey: String? = null
  override var onError: ((String) -> Unit)? = null

  private var loadedKey: String? = null
  private var lastRecyclingKey: String? = null

  // Props arrive as one batch; load once per batch.
  override fun afterUpdate() {
    view.scaleType = scaleType(resizeMode ?: NativeResizeMode.COVER)
    view.colorFilter = tintColor?.let { PorterDuffColorFilter(it.toLong().toInt(), PorterDuff.Mode.SRC_IN) }
    if (recyclingKey != lastRecyclingKey) {
      lastRecyclingKey = recyclingKey
      view.setImageDrawable(null)
      loadedKey = null
    }
    val w = decodeWidth?.toInt() ?: 0
    val h = decodeHeight?.toInt() ?: 0
    if (w <= 0 || h <= 0) return // not laid out yet
    val key = "$uri|$resource|${w}x$h"
    if (key == loadedKey) return
    loadedKey = key
    load(w, h)
  }

  private fun load(w: Int, h: Int) {
    val data: Any = resource?.takeIf { it.isNotEmpty() }?.let { name ->
      val id = context.resources.getIdentifier(name, "drawable", context.packageName)
      if (id == 0) { onError?.invoke("Bundled image not found: $name"); return }
      id
    } ?: uri ?: run { view.setImageDrawable(null); return }
    val request = ImageRequest.Builder(context)
      .data(data)
      .target(view)
      .size(w, h)
      .precision(Precision.INEXACT)
      .allowHardware(true)
      .listener(onError = { _, r -> onError?.invoke(r.throwable.message ?: "Image load failed") })
      .build()
    ImageLoaders.get(context).enqueue(request) // cancels the previous request on this view
  }

  private fun scaleType(mode: NativeResizeMode): ImageView.ScaleType = when (mode) {
    NativeResizeMode.COVER -> ImageView.ScaleType.CENTER_CROP
    NativeResizeMode.CONTAIN -> ImageView.ScaleType.FIT_CENTER
    NativeResizeMode.STRETCH -> ImageView.ScaleType.FIT_XY
    NativeResizeMode.CENTER -> ImageView.ScaleType.CENTER
  }

  override fun onDropView() {
    CoilUtils.dispose(view)
  }

  // Reset everything: props are only re-applied on a recycled view if the next consumer sets them.
  override fun prepareForRecycle() {
    CoilUtils.dispose(view)
    view.setImageDrawable(null)
    view.colorFilter = null
    uri = null; resource = null; resizeMode = null; tintColor = null
    decodeWidth = null; decodeHeight = null; recyclingKey = null; onError = null
    loadedKey = null; lastRecyclingKey = null
  }
}
