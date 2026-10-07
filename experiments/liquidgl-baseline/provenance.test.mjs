// Read-only byte and scope checks; do not import or execute the vendor script.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
const root = new URL('./', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'));
test('the isolated baseline retains exact reviewed upstream bytes', async () => {
  assert.equal(manifest.commit, '88f681ab7035fd55b04f63edff1841e32c4199e9');
  assert.equal(manifest.sourceKind, 'reconstructed-scene');
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(file.local, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.equal(
      createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      file.gitBlob
    );
    assert.equal(file.modifications, 'none');
    if (file.bytes !== undefined) assert.equal(bytes.length, file.bytes);
  }
});
test('the complete license and excluded-asset boundary stay with the script', async () => {
  assert.deepEqual((await readdir(new URL('vendor/', root))).sort(), ['LICENSE', 'liquidGL.js']);
  const license = await readFile(new URL('vendor/LICENSE', root), 'utf8');
  assert.match(license, /Copyright \(c\) NaughtyDuk/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
  assert.match(license, /Exclusion of Assets/);
  assert.match(license, /applies only to the source code/);
});

test('caught renderer diagnostics cannot produce an empty error report', async () => {
  const { recordBrowserSignal } = await import('./diagnostics.mjs');
  const report = { errors: [], browserSignals: [] };
  for (const [type, text] of [
    ['pageerror', 'uncaught fixture failure'],
    ['error', 'Shader error compile failed'],
    ['error', 'liquidGL: Dynamic element capture failed.'],
    ['warning', 'liquidGL: WebGPU device lost: device removed'],
    ['warning', 'liquidGL: WebGPU region upload failed'],
    ['error', '[baseline] WebGL context lost'],
  ])
    recordBrowserSignal(report, type, text);
  assert.equal(report.errors.length, 6);
  recordBrowserSignal(report, 'warning', 'browser performance observation');
  assert.equal(report.errors.length, 6);
  assert.equal(report.browserSignals.length, 7, 'nonfatal diagnostics stay visible');
});

test('expected CSS fallback remains observable without claiming a renderer failure', async () => {
  const { recordBrowserSignal } = await import('./diagnostics.mjs');
  const report = { errors: [], browserSignals: [] };
  const text = 'liquidGL: WebGPU/WebGL not available – falling back to CSS backdrop-filter.';
  recordBrowserSignal(report, 'warning', text);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.browserSignals, [{ type: 'warning', text }]);
  recordBrowserSignal(report, 'warning', 'liquidGL: WebGPU device lost: unexpected failure');
  assert.equal(report.errors.length, 1);
});
