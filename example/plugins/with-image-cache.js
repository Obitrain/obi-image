const { withAppDelegate } = require('expo/config-plugins');

module.exports = (config) =>
  withAppDelegate(config, (mod) => {
    const anchor = 'let delegate = ReactNativeDelegate()';
    const cache =
      'URLCache.shared = URLCache(memoryCapacity: 32 << 20, diskCapacity: 256 << 20, directory: nil)';
    if (
      mod.modResults.language !== 'swift' ||
      !mod.modResults.contents.includes(anchor)
    ) {
      throw new Error(
        'Unsupported Expo AppDelegate: image cache setup anchor missing'
      );
    }
    if (!mod.modResults.contents.includes(cache)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        anchor,
        `${cache}\n    ${anchor}`
      );
    }
    return mod;
  });
