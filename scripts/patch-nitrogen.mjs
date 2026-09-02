// RN 0.87 asserts that Fabric component views set `_props` in their constructor;
// nitrogen 0.36.x's generated view component doesn't (fixed upstream in nitro 0.37). Patch it after each `nitrogen` run.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'nitrogen/generated/ios/c++/views';
for (const file of readdirSync(dir).filter((f) => f.endsWith('Component.mm'))) {
  const path = join(dir, file);
  const src = readFileSync(path, 'utf8');
  const m = src.match(/using (Hybrid\w+ShadowNode) = /) ?? src.match(/(Hybrid\w+)ComponentDescriptor/);
  const name = file.replace('Component.mm', '');
  const inject = `  if (self = [super init]) {\n    _props = ${name}ShadowNode::defaultSharedProps(); // RN >= 0.87 requires default props before updateProps\n`;
  if (src.includes('defaultSharedProps()')) continue;
  const out = src.replace('  if (self = [super init]) {\n', inject);
  if (out === src) throw new Error(`patch-nitrogen: init pattern not found in ${path}`);
  writeFileSync(path, out);
  console.log(`patched ${path}`);
}
