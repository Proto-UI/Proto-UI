import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { tabsControl } from './tabs-controls.mjs';
import { evaluateTabs } from './tabs-oracle.mjs';
import { TABS_POLICY } from './tabs-policy.mjs';

const enabled = process.env.PROTO_BENCHMARK_BROWSER_TESTS === '1';
const root = process.env.PROTO_BENCHMARK_EVIDENCE_ROOT || os.tmpdir();
await mkdir(root, { recursive: true });
const chromiumPath = process.env.PROTO_BENCHMARK_CHROMIUM;
const options = { skip: !enabled, timeout: 90000 };
async function evaluate(control) {
  assert.ok(chromiumPath, 'Explicit PROTO_BENCHMARK_CHROMIUM is required');
  const evidenceDir = await mkdtemp(path.join(root, 'independent-tabs-'));
  const htmlPath = path.join(evidenceDir, 'submission.html');
  await writeFile(htmlPath, control);
  const result = await evaluateTabs({ htmlPath, evidenceDir, chromiumPath });
  assert.equal(result.execution, 'completed', JSON.stringify(result.errors));
  assert.equal(result.summary.evidence.blocked, 0, JSON.stringify(result.errors));
  assert.ok(result.artifacts.includes('trace.zip'));
  assert.equal(result.inputSha256, createHash('sha256').update(control).digest('hex'));
  assert.equal(
    JSON.parse(await readFile(path.join(evidenceDir, 'result.json'))).inputSha256,
    result.inputSha256
  );
  console.log(JSON.stringify({ evidenceDir, summary: result.summary }));
  return result;
}
function failures(r) {
  return r.checks.filter((c) => c.status === 'fail').map((c) => c.id);
}
function status(r, id) {
  return r.checks.find((c) => c.id === id)?.status;
}

test('candidate identity and independent source boundaries', async () => {
  assert.equal(TABS_POLICY.status, 'candidate-unreviewed');
  assert.equal(TABS_POLICY.split, 'development');
  assert.notEqual(TABS_POLICY.semanticSource, TABS_POLICY.calibrationSemanticSource);
  const source = await readFile(new URL('./tabs-oracle.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('tabs-controls'));
  assert.ok(!/packages\/(prototypes|runtime|adapters)|#fixture|tab-overview/.test(source));
  assert.notEqual(tabsControl({ seed: 'a' }), tabsControl({ seed: 'b' }));
});
for (const variant of [
  'wrapped',
  'labelled',
  'generic',
  'native-zero',
  'detached',
  'role-list',
  'role-fallback',
  'focus-after-removal',
]) {
  test(`positive semantic alternative: ${variant}`, options, async () => {
    const r = await evaluate(tabsControl({ seed: `positive-${variant}`, variant }));
    assert.deepEqual(failures(r), []);
    assert.equal(status(r, 'cleanup'), 'pass');
    assert.equal(status(r, 'right-skip-disabled'), 'pass');
    assert.equal(status(r, 'enter-activation'), 'pass');
    assert.equal(status(r, 'space-activation'), 'pass');
    assert.equal(r.summary.platform.disputed > 0, variant === 'detached');
    assert.equal(r.admission, 'not-admitted');
  });
}
const negatives = [
  ['duplicate-list', 'discovery', null],
  ['missing-name', 'discovery', null],
  ['dangling-selected', 'initial.present-relationships', 'right-skip-disabled'],
  ['cross-relationships', 'initial.present-relationships', 'initial.single-selected'],
  ['missing-panel-label', 'initial.present-relationships', 'right-skip-disabled'],
  ['multiple-tab-stops', 'initial.roving', 'initial.single-selected'],
  ['escaped-focus', 'right-skip-disabled', 'initial.present-relationships'],
  ['navigation-selects', 'right-skip-disabled', 'initial.present-relationships'],
  ['missing-key-activation', 'enter-activation', 'right-skip-disabled'],
  ['disabled-activation', 'disabled-pointer', 'right-skip-disabled'],
  ['extra-panel', 'after-pointer-activation.visible-panel', 'right-skip-disabled'],
  ['duplicate-on-repeat', 'after-pointer-activation.present-relationships', 'right-skip-disabled'],
  ['broken-cleanup', 'cleanup', 'right-skip-disabled'],
  ['cleanup-keyboard-trap', 'cleanup', 'right-skip-disabled'],
  ['role-conflict', 'initial.present-relationships', 'right-skip-disabled'],
];
for (const [mutation, failed, unaffected] of negatives) {
  test(`negative control: ${mutation} rejects ${failed}`, options, async () => {
    const r = await evaluate(
      tabsControl({ seed: `negative-${mutation}`, variant: 'generic', mutation })
    );
    assert.equal(status(r, failed), 'fail', JSON.stringify(failures(r)));
    if (unaffected) assert.equal(status(r, unaffected), 'pass', JSON.stringify(failures(r)));
    if (failed === 'discovery') assert.equal(status(r, 'journey-not-reachable'), 'blocked');
  });
}
