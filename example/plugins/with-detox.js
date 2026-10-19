const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require('expo/config-plugins');

const DETOX_REPO =
  'maven { url(new File(["node", "--print", "require.resolve(\'detox/package.json\')"].execute(null, rootDir).text.trim(), "../Detox-android")) }';
const TEST_RUNNER = [
  "testBuildType System.getProperty('testBuildType', 'debug')",
  "testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
];
const DETOX_DEPENDENCY = "androidTestImplementation('com.wix:detox:+')";
// Minified release apps must keep what the test APK expects them to provide (e.g. androidx.tracing).
const DETOX_PROGUARD =
  'proguardFile(new File(["node", "--print", "require.resolve(\'detox/package.json\')"].execute(null, rootDir).text.trim(), "../android/detox/proguard-rules-app.pro"))';

/** Inserts `lines` after `anchor` once; throws when the Expo template no longer has the anchor. */
function insertAfter(contents, anchor, lines, indent, what) {
  if (lines.every((line) => contents.includes(line))) return contents;
  if (!contents.includes(anchor)) {
    throw new Error(`Unsupported Expo Gradle template: ${what} anchor missing`);
  }
  const block = lines.map((line) => `${indent}${line}`).join('\n');
  return contents.replace(anchor, `${anchor}\n${block}`);
}

const detoxTest = (pkg) => `package ${pkg};

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;
import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
  @Rule
  public ActivityTestRule<MainActivity> mActivityRule = new ActivityTestRule<>(MainActivity.class, false, false);

  @Test
  public void runDetoxTests() {
    DetoxConfig detoxConfig = new DetoxConfig();
    detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
    detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
    detoxConfig.rnContextLoadTimeoutSec = 60;
    Detox.runTests(mActivityRule, detoxConfig);
  }
}
`;

// Release builds block cleartext; Detox's client talks to ws://localhost through adb reverse.
const NETWORK_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

/** Android wiring Detox needs (iOS needs none): test runner, Detox AAR + keep rules, DetoxTest and localhost cleartext. */
module.exports = (config) => {
  config = withProjectBuildGradle(config, (mod) => {
    mod.modResults.contents = insertAfter(
      mod.modResults.contents,
      'allprojects {\n  repositories {',
      [DETOX_REPO],
      '    ',
      'allprojects repositories'
    );
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    let contents = insertAfter(
      mod.modResults.contents,
      '    defaultConfig {',
      TEST_RUNNER,
      '        ',
      'defaultConfig'
    );
    contents = insertAfter(
      contents,
      '            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"',
      [DETOX_PROGUARD],
      '            ',
      'release proguardFiles'
    );
    contents = insertAfter(
      contents,
      '\ndependencies {',
      [DETOX_DEPENDENCY],
      '    ',
      'dependencies'
    );
    mod.modResults.contents = contents;
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('AndroidManifest has no <application>');
    application.$['android:networkSecurityConfig'] =
      '@xml/network_security_config';
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const pkg = mod.android?.package;
      if (!pkg) throw new Error('with-detox needs expo.android.package');
      const app = path.join(mod.modRequest.platformProjectRoot, 'app/src');
      const testDir = path.join(app, 'androidTest/java', ...pkg.split('.'));
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'DetoxTest.java'), detoxTest(pkg));
      const xmlDir = path.join(app, 'main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_CONFIG
      );
      return mod;
    },
  ]);
};
