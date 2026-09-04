import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../../../', import.meta.url);
const matrixComponent = new URL(
  'apps/www/src/components/PrototypePreviewer/DemoMatrix.astro',
  repositoryRoot
);
const matrixPages = [
  new URL('apps/www/src/content/docs/en/internal/demo-matrix.mdx', repositoryRoot),
  new URL('apps/www/src/content/docs/zh-cn/internal/demo-matrix.mdx', repositoryRoot),
];
const matrixBrowserTest = new URL(
  'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
  repositoryRoot
);

test('Demo Matrix remains development-only documentation', async () => {
  for (const page of matrixPages) {
    const source = await readFile(page, 'utf8');
    assert.match(source, /^draft: true$/m);
  }
});

test('Demo Matrix renders every adapter side by side for each demo', async () => {
  const source = await readFile(matrixComponent, 'utf8');

  assert.match(source, /demos\.length \* runtimes\.length/);
  assert.match(source, /runtimes\.map\(\(runtime\) =>/);
  assert.match(source, /initialRuntime=\{runtime\}/);
  assert.match(source, /runtimes=\{\[runtime\]\}/);
  assert.match(source, /toolbar=\{false\}/);
});

test('Demo Matrix layout and accessibility claims have browser-level coverage', async () => {
  const source = await readFile(matrixBrowserTest, 'utf8');

  assert.match(source, /width: 1440/);
  assert.match(source, /for \(const width of \[320, 390\]\)/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /unnamed visible interactive control/);
  assert.match(source, /accessible controls differ across runtimes/);
});
