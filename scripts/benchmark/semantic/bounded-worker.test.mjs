import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { boundedTabs } from './bounded-worker.mjs';
import { tabsControl } from './tabs-controls.mjs';

const enabled = process.env.PROTO_BENCHMARK_BROWSER_TESTS === '1';
const root = await mkdtemp(
  path.join(process.env.PROTO_BENCHMARK_EVIDENCE_ROOT || os.tmpdir(), 'bounded-browser-')
);
async function run(name, html, wallMs) {
  const input = path.join(root, `${name}.html`);
  await writeFile(input, html);
  const evidenceDir = path.join(root, name);
  const receipt = await boundedTabs({
    htmlPath: input,
    evidenceDir,
    chromiumPath: process.env.PROTO_BENCHMARK_CHROMIUM,
    wallMs,
  });
  assert.equal(await readFile(path.join(evidenceDir, 'submission.html'), 'utf8'), html);
  assert.equal(receipt.admission, 'not-admitted');
  assert.ok(receipt.browserPid, 'Chromium PID must have been registered before page execution');
  assert.equal(receipt.cleanup.length, 2);
  for (const c of receipt.cleanup) assert.equal(c.status, 'no-live-group-members');
  console.log(JSON.stringify({ evidenceDir, receipt }));
  return { receipt, evidenceDir };
}
test(
  'bounded worker completes a real-browser positive control',
  { skip: !enabled, timeout: 60000 },
  async () => {
    const { receipt, evidenceDir } = await run(
      'normal',
      tabsControl({ seed: 'bounded-normal', variant: 'wrapped' }),
      45000
    );
    assert.equal(receipt.outcome, 'completed');
    assert.equal(receipt.deadlineExceeded, false);
    const result = JSON.parse(await readFile(path.join(evidenceDir, 'result.json')));
    assert.equal(result.summary.journey.fail, 0);
    assert.equal(result.execution, 'completed');
  }
);
test(
  'actual infinite page loop is killed and partial evidence retained',
  { skip: !enabled, timeout: 20000 },
  async () => {
    const started = Date.now();
    const { receipt, evidenceDir } = await run(
      'hang',
      '<!doctype html><title>Hang control</title><script>while(true){}</script>',
      5000
    );
    assert.equal(receipt.outcome, 'aborted');
    assert.equal(receipt.deadlineExceeded, true);
    assert.equal(receipt.signal, 'SIGKILL');
    assert.ok(Date.now() - started < 15000);
    const progress = JSON.parse(await readFile(path.join(evidenceDir, 'progress.json')));
    assert.equal(progress.stage, 'before-submission');
    await assert.rejects(readFile(path.join(evidenceDir, 'result.json')), /ENOENT/);
  }
);
