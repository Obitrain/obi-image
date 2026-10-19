const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
  conditions: ['obitrain-react-native-image-source'],
});

// HEIC sample as .bin: Android release builds reject .heic drawables, a non-image extension ships it as a raw resource.
config.resolver.assetExts.push('bin');

module.exports = config;
