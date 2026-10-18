// e2e runs on Release builds: JS and assets are bundled, so no Metro or dev launcher is involved.
const arch = process.env.DETOX_ANDROID_ARCH ?? 'arm64-v8a';

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 240000 },
  },
  apps: {
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Release-iphonesimulator/ReactNativeImageExample.app',
      build:
        "xcodebuild -workspace ios/ReactNativeImageExample.xcworkspace -scheme ReactNativeImageExample -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build",
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
      build: `cd android && ./gradlew :app:assembleRelease :app:assembleAndroidTest -DtestBuildType=release -PreactNativeArchitectures=${arch}`,
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: process.env.DETOX_IOS_DEVICE ?? 'iPhone 17' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: process.env.DETOX_AVD ?? 'Medium_Phone' },
    },
    attached: {
      type: 'android.attached',
      device: { adbName: process.env.DETOX_ADB_NAME ?? '.*' },
    },
  },
  configurations: {
    'ios.sim.release': { device: 'simulator', app: 'ios.release' },
    'android.emu.release': { device: 'emulator', app: 'android.release' },
    'android.att.release': { device: 'attached', app: 'android.release' },
  },
};
