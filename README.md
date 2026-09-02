# @obitrain/react-native-image

Drop-in replacement for `@d11/react-native-fast-image` as used by obiapp, built as a **Nitro view**
(`react-native-nitro-modules` 0.36.x) with **Kingfisher** on iOS and **Coil 3** on Android.
What it adds over FastImage: **decode-to-size** — every image is decoded at the view's pixel size
(ImageIO `CGImageSourceCreateThumbnailAtIndex` / Coil `size()`), never at full resolution — and a `prefetch()` API.

Measured in Release builds (60-row thumbnail list, same scripted scroll): iOS −8…−10 % CPU and **−52 % peak memory**
vs FastImage (244 vs 512 MB); Android slightly ahead of FastImage on jank and frame times at equal CPU.
Full method, tables and caveats: [docs/benchmark-2026-09.md](docs/benchmark-2026-09.md).

## Requirements

- React Native **0.87.x**, New Architecture (Fabric), bare RN (no Expo needed).
- `react-native-nitro-modules` **0.36.x** in the app (peer dependency `>=0.35.0 <0.37.0`).
- iOS 15.1+, Xcode 16.4+ (tested on Xcode 26 / Swift 6.2), CocoaPods. Android minSdk 24, Kotlin 2.2+, NDK 27.

## Installation

The package is distributed from this repository (private GitHub), not from npm:

```jsonc
// package.json
"@obitrain/react-native-image": "Andarius/obitrain-image#v0.1.1"
```

`yarn install` clones the tag, runs `prepack` (`bob build`) and packs `src`, `lib`, `ios`, `android` and the committed
`nitrogen/generated` code. Then `pod install` on iOS; Android autolinks. Kingfisher (`~> 8.12`) and Coil (`3.4.0`)
are pulled in by the podspec / `build.gradle`. A release also ships the npm tarball as an asset:
https://github.com/Andarius/obitrain-image/releases.

## Usage

```tsx
import { Image, prefetch } from '@obitrain/react-native-image';

<Image source={{ uri }} resizeMode="cover" style={{ width: 70, height: 50, borderRadius: 10 }} onError={() => setFallback(true)} />
<Image source={require('./icon.png')} tintColor="red" resizeMode="contain" style={{ width: 30, height: 30 }} />
<Image source={{ uri }} style={styles.card}>
  <Pressable style={StyleSheet.absoluteFill} onPress={open} />   {/* children render above the image and are tappable */}
</Image>
<FlatList renderItem={({ item }) => <Image source={{ uri: item.uri }} recyclingKey={item.id} style={styles.thumb} />} />

await prefetch(nextScreen.map((r) => r.thumbUrl)); // warm the disk cache (iOS: memory too) before navigating
```

| Prop | Type | Notes |
|---|---|---|
| `source` | `{ uri: string }` \| `number` (`require()`) | Bundled assets resolve to http (Metro), `file://` (iOS release) or a drawable (Android release). |
| `resizeMode` | `'cover'` (default) \| `'contain'` \| `'center'` \| `'stretch'` | Same names as FastImage / RN. |
| `style` | `StyleProp<ViewStyle>` | Applied to the wrapper `View`; `borderRadius` clips. **Give a numeric `width`/`height`** so the decode size is known at first render. |
| `tintColor` | `ColorValue` | Template-renders the image (icons). |
| `onError` | `() => void` | Fires when the load fails (404, decode error, missing bundled asset). |
| `recyclingKey` | `string` | Set to the row id in lists so a recycled cell never shows the previous row's image. |
| `children` | `ReactNode` | Rendered as siblings above the native image view — overlays, buttons. |
| `...ViewProps` | | `testID`, `accessibilityLabel`, `pointerEvents`, … go to the wrapper `View`. |

`prefetch(urls: string[]): Promise<void>` — fetches into the cache; per-URL failures are ignored (they just stay uncached).

Not supported (by design, obiapp does not use them): `priority`, `cacheControl`, `headers`, `defaultSource`, `onLoad`,
animated GIF playback on iOS (first frame is shown), `ph://` Photos URIs.

## How it works

- `src/Image.tsx` — JS wrapper with FastImage-shaped props. Owns `require()` resolution, points→pixels (`PixelRatio`),
  and the `View{overflow:'hidden'}` + absolute-fill native view + children layout that gives `borderRadius` clipping and
  tappable overlays for free (the same trick FastImage uses). Wrapped in `React.memo`; `onError` is memoized and wrapped
  with Nitro's `callback()` (Nitro views require function props to be wrapped).
- `src/ImageView.nitro.ts` — the Nitro view spec (`ObitrainImageView`); `src/ImagePrefetcher.nitro.ts` — the prefetch module.
- `ios/HybridImageView.swift` — `UIImageView` + Kingfisher `DownsamplingImageProcessor` (pixel size, `.scaleFactor(1)`,
  `cover` decodes with 1.25× headroom so the short side still fills). Originals go to disk (`.cacheOriginalImage`) so a
  new size never re-downloads; the downsampled bitmap is memory-only (custom `CacheSerializer` returning no data).
  `kf.setImage` cancels the previous task per view; `prepareForRecycle` resets everything.
- `android/.../HybridImageView.kt` — `AppCompatImageView` + a library-owned Coil `ImageLoader` (`ImageLoaders.kt`:
  own disk cache dir, 10 % memory cache, `allowRgb565`) with `size(w,h)` + `Precision.INEXACT`. Coil disposes the
  previous request per view.

## Toolchain notes (RN 0.87.1 + nitro 0.36.5) — read before touching the native side

- `react-native-nitro-modules` / `nitrogen` are pinned to **0.36.5** (obiapp's pin). Do not bump to 0.37 without
  re-validating the app's other Nitro modules; 0.37 would make the first two workarounds below unnecessary.
- **RN 0.87 requires Fabric component views to set `_props` in their constructor**; nitrogen 0.36.x does not emit that.
  `scripts/patch-nitrogen.mjs` patches the generated `*Component.mm` after every `yarn nitrogen`. Without it the app
  aborts on first mount: `RCTViewComponentView subclasses ... must setup _props instance variable`.
- **Xcode 26 / Swift 6.2**: nitrogen 0.36 emits `Bool(fromCxx:)`, rejected by Swift 6.2; the podspec `script_phase`
  rewrites it (same workaround as `@kingstinct/react-native-healthkit`).
- **Never name a Nitro view `ImageView`**: Fabric resolves that name to React Native's own `RCTImageComponentView` and
  silently renders core `<Image>` instead of yours. Hence `ObitrainImageView`.
- **Pin `ndkVersion` to the app's** (`getExtOrDefault("ndkVersion")`, default 27.1.12297006). Built with a newer NDK
  (28), the `.so` needs `__cxa_init_primary_exception`, which the `libc++_shared.so` packaged by react-android/fbjni
  (NDK 27) lacks → `UnsatisfiedLinkError: dlopen failed` at launch, **Release builds only**.
- Coil stays on **3.4.0** (Kotlin 2.3.10 metadata); 3.5+ is compiled with Kotlin 2.4 and cannot be consumed by a
  Kotlin 2.2 app.
- Kingfisher: do not combine `.cacheMemoryOnly` with `.cacheOriginalImage` (fatal error in `CacheCallbackCoordinator`);
  the memory-only serializer is the safe equivalent. Do not add `.backgroundDecode`: ImageIO thumbnails are already decoded.
- `nitrogen/generated` is committed (like react-native-mmkv) so consumers need no codegen step. Regenerate with
  `yarn nitrogen` after editing any `*.nitro.ts`, and commit the result.

## Development

```bash
yarn                     # installs the library and the example workspace (nitro pinned to 0.36.5)
yarn nitrogen            # regenerate Nitro specs (+ RN 0.87 patch)
yarn typecheck && yarn lint
yarn example start --port 8083          # Metro for the example (8081 is often taken by obiapp's)
yarn example ios                        # AppDelegate points at 8083 in Debug
cd example/android && ./gradlew :app:assembleDebug -PreactNativeDevServerPort=8083   # Android needs the port at build time
```

`example/` (RN 0.87.1) has a **Demo** screen (the vertical-slice checks: decode-to-size, `require()` + tint, tappable
overlay, `onError`, prefetch, 200-row recycling list) and a **Bench** screen (`rn` core `<Image>` / `fast` FastImage /
`obi` this library × `thumb` / `card` / `classic`, 60 distinct URLs per run). The measurement scripts and the full
results are in [docs/benchmark-2026-09.md](docs/benchmark-2026-09.md).

## Releasing

```bash
yarn version <x.y.z>                    # bump package.json
git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push origin main vX.Y.Z
yarn pack --out /tmp/obitrain-react-native-image-X.Y.Z.tgz
gh release create vX.Y.Z /tmp/obitrain-react-native-image-X.Y.Z.tgz --title vX.Y.Z --generate-notes
```

Consumers pin the tag: `"@obitrain/react-native-image": "Andarius/obitrain-image#vX.Y.Z"`.
