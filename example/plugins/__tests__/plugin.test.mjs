import assert from 'node:assert/strict';
import { test } from 'node:test';
import plugin from '../with-image-cache.js';

const delegate = `import React
class AppDelegate: ExpoAppDelegate {
  func launch() {
    let delegate = ReactNativeDelegate()
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {}
`;

async function apply(mod, contents, language = 'swift') {
  const config = plugin({ name: 'Example', slug: 'example' });
  const result = await config.mods.ios[mod]({
    ...config,
    modResults: { contents, language },
    modRequest: { platform: 'ios', modName: mod },
  });
  return result.modResults.contents;
}

for (const [name, contents, language] of [
  ['changed Swift template', 'class AppDelegate {}', 'swift'],
  ['Objective-C template', delegate, 'objc'],
]) {
  test(`rejects ${name} instead of silently losing native setup`, async () => {
    await assert.rejects(
      apply('appDelegate', contents, language),
      /Unsupported Expo AppDelegate/
    );
  });
}

test('preserves benchmark cache sizes through repeated generation', async () => {
  const result = await apply('appDelegate', delegate);
  assert.match(
    result,
    /URLCache\.shared = URLCache\(memoryCapacity: 32 << 20, diskCapacity: 256 << 20, directory: nil\)/
  );
  assert.equal(await apply('appDelegate', result), result);
});
