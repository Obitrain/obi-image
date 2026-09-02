# `@obitrain/react-native-image` — Session 1 report

**Date:** 2026-09-01 / 02 · **Scope:** build a decode-to-size image view as a Nitro view, validate it, benchmark it against bare RN `<Image>` and FastImage on both platforms, and decide whether to keep going.

**Verdict up front (updated after the Release runs, §4.5–4.6): the library is now measurably better than FastImage on iOS (−8…−10 % CPU, −52 % peak RSS) and at least as good on Android (jank 31.7 % vs 34.8 %, CPU equal, +13 MB RSS). Switching is worth it *if* the memory win matters to you (image-heavy lists on low-RAM devices) and you accept owning a Nitro view on nitro 0.36 with two codegen workarounds; if not, FastImage + the decode-to-size patch gets most of the iOS memory win for far less ownership. Section 5 has the full reasoning.** Details in [Verdict](#verdict).

---

## 1. What was built

`@obitrain/react-native-image` v0.1.0 — a **Nitro view** (`react-native-nitro-modules` + `nitrogen` pinned **0.36.5**, RN **0.87.1**, New Architecture), Swift + **Kingfisher 8.12** on iOS, Kotlin + **Coil 3.4.0** on Android. The one thing FastImage does not do: **decode-to-size** — the bitmap is decoded at the view's pixel size (ImageIO `CGImageSourceCreateThumbnailAtIndex` / Coil `size()`), never at full resolution.

| Layer | File | Role |
|---|---|---|
| JS wrapper | `src/Image.tsx` | FastImage-shaped props; `View{overflow:hidden}` + absolute-fill native view + children (gives `borderRadius` clipping and tappable overlays for free); `require()` resolution; points→pixels via `PixelRatio`; decode size from `onLayout`; memoized `callback()`-wrapped `onError` |
| Spec | `src/ImageView.nitro.ts` | Nitro view spec `ObitrainImageView` |
| iOS | `ios/HybridImageView.swift` | `UIImageView` + Kingfisher `DownsamplingImageProcessor` (pixels, `.scaleFactor(1)`, `.cacheOriginalImage`), per-view task cancellation |
| Android | `android/.../HybridImageView.kt`, `ImageLoaders.kt` | `AppCompatImageView` + library-owned Coil `ImageLoader` with `size(w,h)` + `Precision.INEXACT`, own disk-cache dir |
| Build | `ReactNativeImage.podspec`, `android/build.gradle`, `scripts/patch-nitrogen.mjs` | Kingfisher dep + Swift 6.2 `script_phase`; Coil 3.4.0 + `react { jsRootDir = file("../src") }`; nitrogen post-processing |
| Example | `example/src/{App,Demo,Bench}.tsx` | Vertical-slice screen + benchmark harness (Metro on port 8083) |

Both builds green and installed: iOS `example/ios/build/Build/Products/Debug-iphonesimulator/ReactNativeImageExample.app`, Android `example/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 2. Toolchain findings (the durable output of this session)

These cost the most time and are worth keeping regardless of the adoption decision. All reproduced first-hand.

1. **nitrogen 0.36.5 Nitro *views* compile on RN 0.87.1 but abort at first mount.** Exact runtime abort:
   > `RCTViewComponentView subclasses (and HybridObitrainImageViewComponent particularly) must setup _props instance variable with a default value in the constructor`

   RN 0.87 added this assertion; nitrogen 0.36 does not emit the `_props` initialiser (nitro 0.37 does). Fixed by `scripts/patch-nitrogen.mjs`, which injects `_props = <Name>ShadowNode::defaultSharedProps();` into the generated `*Component.mm` `init` after every `yarn nitrogen`. **This is a real, ongoing cost of staying on nitro 0.36.x for views.**
2. **Xcode 26.0 / Swift 6.2 rejects nitrogen 0.36's generated Swift.** It emits `Bool(fromCxx: cachedCxxPart)` at `nitrogen/generated/ios/swift/*Spec_cxx.swift:78`, which Swift 6.2 will not compile. Worked around with a podspec `script_phase` perl rewrite — the same trick `@kingstinct/react-native-healthkit` uses.
3. **Never name a Nitro view `ImageView`.** Fabric resolves that component name to React Native core's own `RCTImageComponentView` and silently mounts *that* instead of the custom view — no warning, no error; found only by inspecting the native view hierarchy. Renamed the spec to `ObitrainImageView`.
4. **`create-react-native-library@0.63.0` resolves nitro from `dist-tags.latest`** and wrote `^0.37.1`. Hand-pinned to exact `0.36.5` with peer range `>=0.35.0 <0.37.0` to match obiapp.
5. **Kingfisher's `kf` API is `@MainActor`.** View code hops via `MainActor.assumeIsolated` / `Task { @MainActor }`.
6. **Coil pinned to 3.4.0** (Kotlin 2.3.10 metadata). 3.5+/3.6 are built with Kotlin 2.4 and cannot be consumed by obiapp's Kotlin 2.2.0.
7. **Nuke was rejected** earlier in the evaluation: SPM-only since 9.5.0, no CocoaPods support → Kingfisher.
8. **Duplicate-class failure from RN codegen picking up a hoisted peer.** With FastImage hoisted into the workspace root `node_modules`, the library's `apply plugin: "com.facebook.react"` codegen'd FastImage's `*NativeComponent` spec *into this library*. Fixed with `react { jsRootDir = file("../src") }` in `android/build.gradle`.
9. **Environment gotchas worth remembering.**
   - Metro ports 8081/8082 were held by other sessions → this project uses **8083**.
   - On Android, the `RCT_METRO_PORT` env var does **not** work with the RN 0.87 Gradle plugin; the Gradle property `-PreactNativeDevServerPort=8083` does (see `@react-native/gradle-plugin/.../AgpConfiguratorUtils.kt`).
   - The already-running emulator `emulator-5554` (`Pixel_API_34_AOSP`) had **no network interface at all**; booted `obiapp_play34` manually as `emulator-5560` instead.
   - argent's simulator-server refused to start for `emulator-5560`, so Android was driven with raw `adb` (`input tap/swipe`, `screencap`, `dumpsys gfxinfo`).
   - The iPhone 12 simulator is shared with another live session (its foreground app switched to obiapp mid-run and killed one run) → all iOS measurements were moved to a dedicated **iPhone 16 Pro** simulator `AABA0D5B-6795-439B-81D1-2CE7C69E8231` (iOS 18.5).

---

## 3. Vertical slice — PASSED on both platforms

Exercised on the Demo screen, iOS and Android:

| Check | iOS | Android |
|---|---|---|
| Network 70×50pt thumb decodes to size | `decoded 315x177@1.0 for 210x150` (cover headroom ×1.5) | `decoded 235x132 from NETWORK for 184x132` |
| 60×60 icon — no upscale | 60×60 | 60×60 |
| 300×120 card | 1280×720 (max 900×1.5 = 1350 > 1280 → original kept, correct) | 789×444 |
| `require()` PNG + `tintColor` red | pass | pass |
| Children overlay `<Pressable>` inside `<Image>` tappable | taps counter → 2 | taps counter → 2 |
| `onError` on HTTP 404 | "error" shown | "error" shown |
| 200-row recycling list with `recyclingKey`, 5 fast swipes | rows/badges consistent, no stale images | same |
| `borderRadius` clipping (wrapper `overflow:hidden`) | pass | pass |

No functional regressions found.

---

## 4. Benchmark

**Question (owner's requirement):** how does this compare to bare RN `<Image>` on both platforms, with FastImage as the reference point?

**Harness.** Bench screen, 60 rows, distinct URLs `image.jpeg?v=<variant>-thumb-r<run>-<n>` (105 KB, 1280×720 JPEG from `s3.fr-par.scw.cloud/obitrain.shared/e2e-tests/image.jpeg`) so nothing is cache-served. Thumb mode: 70×50pt, `cover`, radius 10. `FlatList` with `windowSize=3` / `initialNumToRender=8` so loads are scroll-driven. Identical scripted scroll for every run: 12 swipes down (0.85→0.15, 250 ms) with 400 ms gaps, 1.5 s pause, 12 swipes back up. **Dev builds, one run per variant per pass, two passes.**

- **Pass 1** — all three variants in the *same* process, order `rn → fast → obi` (so RSS baselines drift upward through the pass).
- **Pass 2** — fresh process per variant (app restart), order `obi → fast → rn`.

**iOS method.** macOS `sample <pid> 30 1` (all threads, symbolized) started immediately before tapping "Run bench"; `ps rss` polled every 0.5 s; CPU from the `ps time` delta. *Main busy* = main-thread samples minus samples parked in `mach_msg2_trap` / `kevent` / `__semwait_signal` etc. — a jank proxy in ≈ms.

**Android method.** `obiapp_play34` emulator (`google_apis_playstore` API 34, arm64), `dumpsys gfxinfo <pkg> reset` before "Run bench" and read after the scroll; RSS from `dumpsys meminfo TOTAL RSS`; CPU from `/proc/<pid>/stat` `utime+stime` ÷ 100.

### 4.1 iOS — iPhone 16 Pro simulator, iOS 18.5

| Pass | Variant | CPU Δ | Main busy (≈ms) | RSS start → peak → end (MB) |
|---|---|---:|---:|---|
| 1 (shared process, `rn→fast→obi`) | RN core `<Image>` | 3.98 s | 1017 | 202 → **207** → 166 |
| 1 | FastImage | 4.96 s | 1324 | 119 → **366** → 157 |
| 1 | **obitrain-image** | 4.49 s | 1065 | 102 → **264** → 157 |
| 2 (fresh process, `obi→fast→rn`) | **obitrain-image** | 4.82 s | 862 | 200 → **293** → 254 |
| 2 | FastImage | 5.10 s | 1270 | 206 → **394** → 189 |
| 2 | RN core `<Image>` | 4.18 s | 996 | 210 → **266** → 176 |

**obi vs FastImage:** main busy −20 % (pass 1) / −32 % (pass 2); peak RSS −28 % / −26 %; total CPU −9 % / −5 %.

Decode symbols (sample-count proxy, pass 1 only — see caveats):

| Variant | Frames seen |
|---|---|
| RN core | *none* |
| FastImage | `SDImageDecodeUIKit` 34 |
| obitrain-image | `CGImageSourceCreateThumbnailAtIndex` 23, `DownsamplingImageProcessor.process` 23, `AppleJPEGReadPlugin` 40, **plus re-encode: `AppleJPEGWritePlugin` 6, `_UIImageJPEGRepresentation` 4, `IIO_Writer_AppleJPEG` 3** |

That re-encode is Kingfisher writing the *processed* (downsampled) image back to its **disk** cache — pure waste for a thumbnail. → v2 item: add `.cacheMemoryOnly` (keeping `.cacheOriginalImage`) so processed images stay memory-only and only originals hit disk. *Verify Kingfisher's exact semantics before treating this as certain.*

### 4.2 Android — `obiapp_play34` emulator (API 34, arm64), dev build

| Pass | Variant | Frames | Janky | p50 | p90 | p99 | RSS start → peak (MB) | CPU |
|---|---|---:|---:|---:|---:|---:|---|---:|
| 1 (shared process, `rn→fast→obi`) | RN core `<Image>` | 553 | 413 (74.7 %) | 73 ms | 133 ms | 200 ms | 165 → 248 (+83) | 16.07 s |
| 1 | FastImage | 472 | 372 (78.8 %) | 85 ms | 150 ms | 200 ms | 239 → 254 (+15) | 14.26 s |
| 1 | **obitrain-image** | 364 | 325 (89.3 %) | 117 ms | 200 ms | 400 ms | 248 → 263 (+15) | 16.64 s |
| 2 (fresh process, `obi→fast→rn`) | **obitrain-image** | 405 | 367 (90.6 %) | 101 ms | 200 ms | 450 ms | 167 → 241 (+73) | 20.19 s |
| 2 | FastImage | 387 | 343 (88.6 %) | 101 ms | 200 ms | 600 ms | 167 → 210 (+42) | 21.05 s |
| 2 | RN core `<Image>` | 360 | 344 (95.6 %) | 133 ms | 200 ms | 600 ms | 167 → 251 (+83) | 21.61 s |

In pass 2 (the fair one) obi and FastImage are within 2 points of each other on jank and within 4 % on CPU; RN core is the worst of the three. Pass 1's ordering makes obi look worse than it is (it ran last, into an already-warm, already-fat process).

### 4.4 Pass 3 — after optimization (2026-09-02, fresh session on both platforms)

Changes since pass 2: the JS wrapper derives the decode size from numeric `style` width/height (no `onLayout → setState`
second render per row; `onLayout` only when the style has no numeric dims) and is wrapped in `React.memo`; on iOS the
downsampled image is kept **memory-only** via a `CacheSerializer` returning no data (originals still go to disk via
`.cacheOriginalImage`), `.backgroundDecode` was dropped (ImageIO thumbnails are already decoded), and
`.keepCurrentImageWhileLoading` avoids the nil-placeholder layer commit. (`.cacheMemoryOnly` + `.cacheOriginalImage`
aborts inside Kingfisher's `CacheCallbackCoordinator` — do not use that pair.) Android native unchanged.

| Platform | Variant (same session, fresh process) | CPU Δ | Main busy / total samples | JS busy | RSS start → peak → end (MB) |
|---|---|---:|---:|---:|---|
| iOS (iPhone 16 Pro sim) | **obitrain-image** | **4.04 s** | 1474 / 24089 (6.1 %) | 1712 | 268 → **309** → 217 |
| iOS | FastImage | 4.58 s | 1277 / 22888 (5.6 %) | 1677 | 213 → **539** → 478 |

| Platform | Variant | Frames | Janky | p50 | p90 | p99 | RSS start → peak | CPU |
|---|---|---:|---:|---:|---:|---:|---|---:|
| Android (API 34 emu) | **obitrain-image** | 727 | 416 (57.2 %) | 53 ms | 81 | 150 | 172 → 225 (+53) | 13.83 s |
| Android | FastImage | 779 | 323 (41.5 %) | 46 ms | 65 | 113 | 172 → 210 (+38) | 12.14 s |

Read: iOS — obitrain-image now uses **12 % less CPU** and **43 % less peak RSS** than FastImage with equal JS-thread
work; the only residual is ~+0.5 pp main-thread busy (Nitro→Swift `updateProps` bridging ≈31 samples, `MainActor`
hop ≈54, more `CALayer` commits). Android — the JS fix moved obitrain-image from 90.6 % janky / p50 101 ms (pass 2) to
57 % / 53 ms, but in the same session Glide-backed FastImage is still ahead (41 % / 46 ms, −12 % CPU, −15 MB RSS growth);
the whole emulator session was ~2× faster than the day before, so only same-session pairs are comparable.
Remaining Android suspects (unmeasured): per-row `ImageRequest` construction + Coil's coroutine dispatch, and Nitro's
per-prop JNI setters (8 props/row) vs FastImage's single codegen delegate.

### 4.5 Release builds (2026-09-02) — the numbers that matter

Same method, same session, fresh process per variant, but **Release** configurations: iOS `-configuration Release`
(bundled Hermes JS, no Metro), Android `assembleRelease` (arm64, Hermes, debug-signed). All three variants in one build.

| iOS Release (iPhone 16 Pro sim) | CPU Δ | Main busy / total (%) | RSS start → peak → end (MB) |
|---|---:|---:|---|
| **obitrain-image** | **2.74 s** | 1185 / 25872 (4.6 %) | 198 → **238** → 213 |
| FastImage | 3.03 s | 1259 / 25675 (4.9 %) | 212 → **512** → 376 |
| RN core `<Image>` | 2.73 s | 1203 / 25952 (4.6 %) | 195 → **239** → 233 |

| Android Release (API 34 emu) | Frames | Janky | p50 | p90 | p99 | RSS start → peak | CPU |
|---|---:|---:|---:|---:|---:|---|---:|
| **obitrain-image** | 741 | 328 (44.3 %) | 44 ms | 73 | 133 | 62 → 115 (+53) | 10.29 s |
| FastImage | 773 | 340 (44.0 %) | 44 ms | 73 | 101 | 63 → 98 (+35) | 10.26 s |
| RN core `<Image>` | 778 | 363 (46.7 %) | 46 ms | 73 | 101 | 63 → 155 (+92) | 10.98 s |

Read: in Release the dev-build noise disappears. **iOS**: obitrain-image and RN core are tied on CPU and main-thread time,
both ~10 % cheaper than FastImage; obitrain-image's peak RSS is **less than half of FastImage's** (238 vs 512 MB) and equal
to RN core's — the decoded-to-size cache is the whole story. **Android**: obitrain-image and FastImage are now
indistinguishable on jank (44 % vs 44 %), p50/p90 (44/73 ms both) and CPU (10.3 s both); the only difference left is
RSS growth (+53 vs +35 MB — Coil's memory cache sized at 15 % vs Glide's default; tunable); RN core is slightly behind on
jank (46.7 %) and clearly behind on memory (+92 MB). Emulator jank percentages are
still an emulator artifact (a real device renders these lists at 60 fps), but the *relative* picture is now clean.

### 4.6 Release, after the perf pass (2026-09-02) — prefetch API, Coil cache 10 % + RGB565, iOS cover headroom 1.25

| Platform (Release, same session, fresh process) | Variant | CPU Δ | Main busy | RSS start → peak (MB) | Jank / p50 / p90 |
|---|---|---:|---:|---|---|
| iOS (iPhone 16 Pro sim) | **obitrain-image** | **2.79 s** | 1188 (5.2 %) | 179 → **244** (+65) | — |
| iOS | FastImage (§4.5) | 3.03 s | 1259 (4.9 %) | 212 → 512 (+300) | — |
| Android (API 34 emu) | **obitrain-image** | 9.77 s | — | 57 → **104** (+47) | **31.7 % / 38 ms / 61 ms** |
| Android | FastImage | 9.50 s | — | 60 → 94 (+34) | 34.8 % / 40 ms / 65 ms |

Android: obitrain-image is now slightly *ahead* of FastImage on jank and frame times (31.7 % vs 34.8 % janky, p50 38 vs
40 ms, p99 93 vs 113 ms) at equal CPU; RSS growth is within 13 MB (Coil keeps decoded-to-size bitmaps in a 10 % memory
cache; Glide's default is smaller). iOS: unchanged within noise (the 1.25 headroom saves decode pixels, not measurable at
this size). `prefetch(urls)` verified on both platforms (iOS: 20 URLs in 311 ms; Android: promise resolves, disk cache only).

**Release-build gotcha found here:** the library's Gradle did not set `ndkVersion`, so AGP compiled the `.so` with the
newest installed NDK (28) whose libc++ exports `__cxa_init_primary_exception`; the app packages `libc++_shared.so` from
react-android/fbjni (NDK 27) which lacks it → `UnsatisfiedLinkError: dlopen failed` at launch in **Release only** (Debug
happened not to reference the symbol). Fixed by `ndkVersion getExtOrDefault("ndkVersion")` (falls back to 27.1.12297006).

### 4.3 Caveats — read before quoting any number above

- **RN core `<Image>` shows zero in-process decode frames in every sample** — no `RCTDecodeImageWithData`, no ImageIO frames, in any pass. Its decode is not observable in-process with this method (likely deferred to CoreAnimation / the render server). The prior obiapp study's "`RCTDecodeImageWithData` 515 ms" figure **could not be reproduced here**, and the RN-core CPU numbers above therefore understate its real cost. The argent `xctrace` attach export likewise contained no decode frames for any variant and was unusable for this metric.
- Decode-symbol counts surfaced **only in pass 1**; pass 2's samples contain none for any variant. At 23–40 samples out of ~330 000 they sit at the edge of this method's noise floor. Treat the decode table as directional evidence that the Kingfisher downsample path is engaged, not as a timing measurement.
- **Simulator + emulator, dev builds, n = 1 per variant per pass.** The Android emulator produces 75–95 % janky frames for *every* variant — the noise floor dominates the signal there.
- Pass 1 has order effects (shared process, warm caches, drifting RSS baselines). Pass 2 is the one to weigh.
- Coil's memory cache (15 % of heap) and Glide's cache both inflate RSS growth on Android; RSS is not a like-for-like decode cost.
- Main-thread busy is a **jank proxy**, not a decode timing.
- Android's obi path does an `onLayout` → `setState` → second render per row that FastImage does not — a genuine design cost of layout-driven decode sizing. An explicit `decodeSize` prop would remove it.

---

## 5. Verdict

**Do not adopt yet. Keep `@d11/react-native-fast-image` plus the ~70-line decode-to-size patch. Re-open only on a physical-device measurement of this library against a *patched* FastImage.**

Against the pass criterion agreed in the plan:

| Criterion | Result |
|---|---|
| obi ≤ FastImage on iOS decode CPU and RSS (thumb) | **Met** — peak RSS −26…−28 %, main busy −20…−32 %, total CPU −5…−9 % |
| Android within +10 % jank of FastImage | **Met** in pass 2 (+2.0 points); pass 1's +10.5 points is an ordering artefact |
| Zero functional regressions | **Met** |
| iOS gain ≥ 20 % vs FastImage → build it; < 20 % → stay on FastImage + patch | **Ambiguous** — ≥20 % on main-thread busy and peak RSS, well under 20 % on total CPU, and the headline *decode CPU* number could not be measured at all |

The library works and its memory profile is genuinely the best of the three. But the honest reading is that the criterion was written expecting a decisive decode-CPU win, and that win is not in the data:

1. **The measured advantage is modest and narrow.** −27 % peak RSS is real and consistent across both passes and both orderings; −5…−9 % total CPU is not a reason to own native code. On this workload (70×50pt thumbs off a 1280×720 source) the decode-to-size benefit is bounded by how small the thumbnails already are.
2. **The comparison is against the wrong baseline.** FastImage can be given the same decode-to-size behaviour via `SDWebImageContextImageThumbnailPixelSize` in roughly **70 lines** (established by the prior investigation). The measured gap is obi vs *unpatched* FastImage — most of the RSS win is plausibly attributable to decode-to-size itself, which the patch also delivers. **obi vs patched FastImage is unmeasured, and that is the only comparison that justifies adoption.**
3. **The maintenance cost is concrete and recurring.** Two codegen workarounds (`patch-nitrogen.mjs`, the podspec `script_phase`), a hand-pinned nitro, a Coil version pinned by Kotlin metadata, and one custom native view per platform that the team owns forever — versus a maintained OSS library plus a small patch. Nitro 0.37 removes one of the two workarounds but is blocked on obiapp's own pin.
4. **All measurements are simulator/emulator dev builds, n = 1.** The Android noise floor (75–95 % jank everywhere) means the Android result is really "no detectable difference", not "on par".
5. **A prior obiapp investigation already identified the bigger win**: several call sites still fetch full-size images even though `getImageThumb()` serves `/thumbs/<w>/`. Auditing those call sites beats any library swap and is cheaper than both options here.

**What would flip this to adopt:** a release-build, physical-device run (one mid-range Android, one older iPhone) of *patched FastImage* vs *obitrain-image* on obiapp's real feed, showing a material peak-RSS or jank advantage — plus at least one case where memory pressure actually causes a kill today. Half a day of work, and it is the right next step before spending the phase-2 estimate below.

The session's most valuable output is not the library — it is section 2. Those findings apply to any Nitro view built on RN 0.87 with nitro 0.36.

---

## 6. Phase 2 estimate (if adoption is approved)

**obiapp integration — ≈ 3 days**

| Item | Est. |
|---|---|
| Wrapper swap in `src/components/Image.ts` (obiapp already funnels every `<Image>` through it) | 0.5 d |
| Local iteration: `portal:` protocol + Metro `watchFolders` so obiapp resolves the library from disk | 0.5 d |
| Publish to the GitLab package registry, project **10478649**, `@obitrain` scope (CI job, `.npmrc` auth, version policy) | 0.5 d |
| Release-build asset checks — `file://` sources and Android `drawable`/resource resolution behave differently once bundled/minified | 0.5 d |
| Full Detox run + fixes (image-dependent selectors, screenshot baselines) | 1.0 d |

**v2 items — ≈ 3.25 days, mostly independent**

| Item | Est. | Note |
|---|---|---|
| `.cacheMemoryOnly` on the Kingfisher processed image | 0.25 d | Removes the JPEG re-encode seen in the samples; verify Kingfisher semantics first |
| Explicit `decodeSize` prop | 0.5 d | Skips the `onLayout` → `setState` round-trip; removes the extra render per row |
| GIF support | 1.0 d | Kingfisher `AnimatedImageView` / Coil `GifDecoder`; FastImage has it today |
| `ph://` (Photos library) sources | 0.5 d | Needed if any obiapp call site uses picker results |
| nitro 0.37 migration | 1.0 d | Deletes `scripts/patch-nitrogen.mjs`; **blocked on obiapp's own nitro pin** |

---

## 7. Top risks

1. **`patch-nitrogen.mjs` fails silently-ish.** If anyone regenerates nitrogen output without running the patch, the app **aborts at first mount** — not a compile error, so CI that only builds will not catch it. Needs a build-time assertion or a test that mounts the view.
2. **The measured win may not survive a release build on a real device.** Everything here is simulator/emulator + dev build, n = 1. Risk of spending the 3-day integration for a difference users cannot perceive.
3. **Two new native dependencies enter obiapp's build** (Kingfisher via CocoaPods, Coil via Gradle) with pins driven by other people's toolchain choices — Coil is stuck at 3.4.0 until obiapp moves off Kotlin 2.2, and app-size impact is not yet measured.
4. **Feature parity with FastImage is not inventoried.** GIF, `ph://`, `priority`, `preload`/`clearCache` static APIs, custom headers — obiapp's call sites have not been audited for what they actually use, so the swap's true surface is unknown.
5. **Layout-driven decode sizing costs an extra render per row** on both platforms. Acceptable in the bench, but obiapp's feed rows are heavier; `decodeSize` should land before, not after, the swap.
6. **Sole ownership.** A custom Nitro view is maintained by this team against RN's Fabric internals, which changed in a breaking way between 0.86 and 0.87 (finding #1) — expect this to recur on every RN upgrade.

---

## Appendix — artifacts

Raw benchmark data and analysis scripts (session scratch, not in the repo):
`/private/tmp/claude-502/-Users-julien-Projects-trame/3e2d3627-3533-439b-be10-49c51c20b943/scratchpad/bench/`
— `ios_measure.sh`, `ios_analyze.py`, `main_busy.py`, `android_bench.sh`, and per-run `ios-<variant>-thumb[-p2].{sample,rss,meta}` / `android-<variant>-thumb[-p2].{gfx,rss,meta}`.
