# @obitrain/react-native-image

A fast image component for React Native, built as a [**Nitro view**](https://nitro.margelo.com) (`react-native-nitro-modules`) with
[**Kingfisher**](https://github.com/onevcat/Kingfisher) on iOS and [**Coil 3**](https://github.com/coil-kt/coil) on Android.
It exposes a [FastImage](https://github.com/DylanVann/react-native-fast-image)-compatible API and adds what FastImage lacks:
**decode-to-size** — every image is decoded at the view's pixel size (ImageIO `CGImageSourceCreateThumbnailAtIndex` /
Coil `size()`), never at full resolution — plus a `prefetch()` API.


## Requirements

- React Native **0.87.x**, New Architecture (Fabric), bare RN or Expo prebuild.
- `react-native-nitro-modules` **0.36.x** in the app (peer dependency `>=0.35.0 <0.37.0`).
- iOS 15.1+, Xcode 16.4+ (tested on Xcode 26 / Swift 6.2), CocoaPods. Android minSdk 24, Kotlin 2.2+, NDK 27.

## Installation

```bash
yarn add @obitrain/react-native-image   # or: npm install @obitrain/react-native-image
cd ios && pod install
```

Android autolinks. Kingfisher (`~> 8.12`) and Coil (`3.4.0`) are pulled in by the podspec / `build.gradle`; the package
ships its generated Nitro code, so no codegen step is needed. You can also pin a release tag
(`"@obitrain/react-native-image": "Obitrain/obi-image#v0.1.1"`) — each GitHub release carries the same tarball.

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

Not supported (yet): `priority`, `cacheControl`, `headers`, `defaultSource`, `onLoad`, animated GIF playback on iOS
(the first frame is shown), `ph://` Photos URIs.

## How it works

- `src/Image.tsx` — JS wrapper with FastImage-shaped props. Owns `require()` resolution, points→pixels (`PixelRatio`),
  and the `View{overflow:'hidden'}` + absolute-fill native view + children layout that gives `borderRadius` clipping and
  tappable overlays for free. Wrapped in `React.memo`; `onError` is memoized and wrapped with Nitro's `callback()`
  (Nitro views require function props to be wrapped).
- `src/ImageView.nitro.ts` — the Nitro view spec (`ObitrainImageView`); `src/ImagePrefetcher.nitro.ts` — the prefetch module.
- `ios/HybridImageView.swift` — `UIImageView` + Kingfisher `DownsamplingImageProcessor` (pixel size, `.scaleFactor(1)`,
  `cover` decodes with 1.25× headroom so the short side still fills). Originals go to disk (`.cacheOriginalImage`) so a
  new size never re-downloads; the downsampled bitmap is memory-only (custom `CacheSerializer` returning no data).
  `kf.setImage` cancels the previous task per view; `prepareForRecycle` resets everything.
- `android/.../HybridImageView.kt` — `AppCompatImageView` + a library-owned Coil `ImageLoader` (`ImageLoaders.kt`:
  own disk cache dir, 10 % memory cache, `allowRgb565`) with `size(w,h)` + `Precision.INEXACT`. Coil disposes the
  previous request per view.

## Toolchain notes (RN 0.87 + nitro 0.36) — read before touching the native side

- `react-native-nitro-modules` / `nitrogen` are pinned to **0.36.5**. nitro 0.37 would make the first two workarounds
  below unnecessary; bump both together and re-run `yarn nitrogen`.
- **RN 0.87 requires Fabric component views to set `_props` in their constructor**; nitrogen 0.36.x does not emit that.
  `scripts/patch-nitrogen.mjs` patches the generated `*Component.mm` after every `yarn nitrogen`. Without it the app
  aborts on first mount: `RCTViewComponentView subclasses ... must setup _props instance variable`.
- **Xcode 26 / Swift 6.2**: nitrogen 0.36 emits `Bool(fromCxx:)`, rejected by Swift 6.2; the podspec `script_phase`
  rewrites it.
- **Never name a Nitro view `ImageView`**: Fabric resolves that name to React Native's own `RCTImageComponentView` and
  silently renders core `<Image>` instead of yours. Hence `ObitrainImageView`.
- **Pin `ndkVersion` to the app's** (`getExtOrDefault("ndkVersion")`, default 27.1.12297006). Built with a newer NDK
  (28), the `.so` needs `__cxa_init_primary_exception`, which the `libc++_shared.so` packaged by react-android/fbjni
  (NDK 27) lacks → `UnsatisfiedLinkError: dlopen failed` at launch, **Release builds only**.
- Coil stays on **3.4.0** (Kotlin 2.3.10 metadata); 3.5+ is compiled with Kotlin 2.4 and cannot be consumed by a
  Kotlin 2.2 app.
- Kingfisher: do not combine `.cacheMemoryOnly` with `.cacheOriginalImage` (fatal error in `CacheCallbackCoordinator`);
  the memory-only serializer is the safe equivalent. Do not add `.backgroundDecode`: ImageIO thumbnails are already decoded.
- `nitrogen/generated` and `src/generated` are committed so consumers need no codegen step. Regenerate with
  `yarn nitrogen` after editing any `*.nitro.ts`, and commit the result.

## Development

```bash
yarn                     # installs the library and the example workspace (nitro pinned to 0.36.5)
yarn nitrogen            # regenerate Nitro specs (+ RN 0.87 patch + view config module)
yarn typecheck && yarn lint
yarn example start --port 8083          # Metro for the example (the example is wired to 8083)
yarn example ios                        # AppDelegate points at 8083 in Debug
cd example/android && ./gradlew :app:assembleDebug -PreactNativeDevServerPort=8083   # Android needs the port at build time
```

`example/` (RN 0.87.1) has a **Demo** screen exercising the whole surface: decode-to-size, `require()` + tint, tappable
overlay, `onError`, prefetch and a 200-row recycling list.

## Releasing

```bash
scripts/release.sh 0.1.2
```

Bumps `package.json`, regenerates and commits the Nitro code, runs the checks, tags `v0.1.2` and pushes. The
`publish.yml` workflow then creates the GitHub release (with the tarball) and publishes to npm through
[trusted publishing](https://docs.npmjs.com/trusted-publishers) — no token to manage.

## License

MIT
