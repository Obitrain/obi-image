import assert from 'node:assert/strict';
import { test } from 'node:test';
import plugin from '../with-kotlin-classpath.js';

async function apply(contents) {
  const config = plugin({ name: 'Example', slug: 'example' });
  const result = await config.mods.android.projectBuildGradle({
    ...config,
    modResults: { contents, language: 'groovy' },
    modRequest: { platform: 'android', modName: 'projectBuildGradle' },
  });
  return result.modResults.contents;
}

test('aligns the root compiler and tolerates repeated generation', async () => {
  const result = await apply("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')");
  assert.equal(result, "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0')");
  assert.equal(await apply(result), result);
  await assert.rejects(apply('buildscript {}'), /Kotlin classpath missing/);
});
