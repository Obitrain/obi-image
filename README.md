# @obitrain/react-native-image

Drop-in replacement for `@d11/react-native-fast-image` as used by obiapp, built as a **Nitro view**
(react-native-nitro-modules 0.36.x) with **Kingfisher** on iOS and **Coil 3** on Android.
The one feature FastImage lacks and this adds: **decode-to-size** — images are decoded at the
view's pixel size (ImageIO `CGImageSourceCreateThumbnailAtIndex` / Coil `size()`), never at full resolution.

```tsx
import { Image } from '@obitrain/react-native-image';

<Image source={{ uri }} resizeMode="cover" style={{ width: 70, height: 50, borderRadius: 10 }} onError={() => {}} />
<Image source={require('./icon.png')} tintColor="red" style={{ width: 30, height: 30 }} />
<Image source={{ uri }} style={styles.card}><Pressable style={StyleSheet.absoluteFill} onPress={...} /></Image>
<FlatList renderItem={({ item }) => <Image source={{ uri: item.uri }} recyclingKey={item.id} style={styles.thumb} />} />
```

API: `prefetch(urls: string[]): Promise<void>` warms the disk cache for the next screen (iOS also memory).

Props: `source` (`{uri}` or `require()`), `resizeMode` (`cover` | `contain` | `center` | `stretch`), `style`
(any `ViewStyle`, `borderRadius` clips), `tintColor`, `onError`, `recyclingKey` (set in lists), `children`
(rendered above the image, tappable). The decode size is derived from the laid-out size × `PixelRatio`.

## How it works

- `src/Image.tsx` — JS wrapper (FastImage-shaped props). Owns `require()` resolution, points→pixels, and the
  `View{overflow:hidden}` + absolute-fill native view + children layout that gives `borderRadius` and overlays for free.
- `src/ImageView.nitro.ts` — the Nitro view spec (`ObitrainImageView`).
- `ios/HybridImageView.swift` — `UIImageView` + Kingfisher `DownsamplingImageProcessor` (pixels, `.scaleFactor(1)`),
  `.cacheOriginalImage` (original bytes stay on disk; a new size never re-downloads), per-view task cancellation.
- `android/.../HybridImageView.kt` — `AppCompatImageView` + a library-owned Coil `ImageLoader`
  (`ImageLoaders.kt`, own disk cache dir) with `size(w,h)` + `Precision.INEXACT`.

## Performance notes

- Give images a numeric `width`/`height` in `style` (all obiapp sites do): the decode size is then known at first
  render and there is no `onLayout → setState` second render per row. Without numeric dims the wrapper falls back to `onLayout`.
- iOS: downsampled images are memory-only (a `CacheSerializer` returning no data); originals are cached on disk
  (`.cacheOriginalImage`) so a new size never re-downloads. Do not combine `.cacheMemoryOnly` with `.cacheOriginalImage`
  (Kingfisher `fatalError` in `CacheCallbackCoordinator`). No `.backgroundDecode`: ImageIO thumbnails are already decoded.
- Measured in **Release** builds (same session, 60-row 70×50 list, simulator/emulator): iOS −8…−10 % CPU and **−52 % peak RSS**
  vs FastImage (244 vs 512 MB), tied with RN core on CPU; Android slightly ahead of FastImage on jank/p50 (31.7 % vs 34.8 %,
  38 vs 40 ms) at equal CPU, +13 MB RSS growth (Coil memory cache 10 %). See `.scratch/session-1-report.md` §4.5–4.6.

## Toolchain notes (RN 0.87.1 + nitro 0.36.5)

- `react-native-nitro-modules` / `nitrogen` are pinned to **0.36.5** (obiapp's pin). Do not bump to 0.37.
- **RN 0.87 requires Fabric component views to set `_props` in their constructor**; nitrogen 0.36.x does not emit that
  (fixed upstream in nitro 0.37). `scripts/patch-nitrogen.mjs` patches the generated `*Component.mm` after every
  `yarn nitrogen` — without it the app aborts on first mount with
  `RCTViewComponentView subclasses ... must setup _props`.
- **Xcode 26 / Swift 6.2**: nitrogen 0.36 emits `Bool(fromCxx:)` which Swift 6.2 rejects; the podspec `script_phase`
  rewrites it (same workaround as `@kingstinct/react-native-healthkit`).
- Do not name a Nitro view `ImageView`: Fabric resolves that name to React Native's own `RCTImageComponentView`
  and silently renders core `<Image>` instead of yours. Hence `ObitrainImageView`.
- **Pin `ndkVersion` to the app's** (done via `getExtOrDefault("ndkVersion")`, default 27.1.12297006): building the library with a newer
  NDK (28) makes the `.so` need `__cxa_init_primary_exception`, absent from the `libc++_shared.so` react-android/fbjni package → Release-only
  `UnsatisfiedLinkError` at launch.
- Coil is pinned to **3.4.0** (Kotlin 2.3.10 metadata); 3.5+ is built with Kotlin 2.4 and cannot be consumed by obiapp's Kotlin 2.2.

## Example app

`example/` (RN 0.87.1). Metro runs on port **8083** (`yarn example start --port 8083`; the iOS AppDelegate and the
Android build (`-PreactNativeDevServerPort=8083`) point at it). Screens: **Demo** (vertical-slice checks) and
**Bench** (`rn` core `<Image>` / `fast` FastImage / `obi` this library × `thumb` / `card` / `classic`, 60 distinct URLs per run).
