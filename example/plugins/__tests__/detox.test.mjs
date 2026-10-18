import assert from 'node:assert/strict';
import { test } from 'node:test';
import plugin from '../with-detox.js';

const projectGradle = `allprojects {
  repositories {
    google()
  }
}
`;
const appGradle = `android {
    defaultConfig {
        applicationId 'example'
    }
    buildTypes {
        release {
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
}
`;

async function apply(mod, contents) {
  const config = plugin({
    name: 'Example',
    slug: 'example',
    android: { package: 'example' },
  });
  const result = await config.mods.android[mod]({
    ...config,
    modResults: { contents, language: 'groovy' },
    modRequest: { platform: 'android', modName: mod },
  });
  return result.modResults.contents;
}

for (const [mod, contents, expected] of [
  ['projectBuildGradle', projectGradle, ['detox/package.json', 'Detox-android']],
  [
    'appBuildGradle',
    appGradle,
    [
      "testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
      "androidTestImplementation('com.wix:detox:+')",
      'proguard-rules-app.pro',
    ],
  ],
]) {
  test(`${mod}: adds the Detox wiring once`, async () => {
    const result = await apply(mod, contents);
    for (const line of expected) assert.ok(result.includes(line), line);
    assert.equal(await apply(mod, result), result);
  });

  test(`${mod}: rejects a changed template instead of skipping Detox`, async () => {
    await assert.rejects(apply(mod, '// empty'), /anchor missing/);
  });
}
