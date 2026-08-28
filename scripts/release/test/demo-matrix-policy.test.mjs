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
  assert.match(source, /grid-template-columns: repeat\(auto-fit, minmax\(15rem, 1fr\)\)/);
});
