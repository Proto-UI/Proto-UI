import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPipelineTerminal } from './verify-result.mjs';

const candidate = 'a'.repeat(40);
function terminal() {
  const source = { head: candidate, tree: 'b'.repeat(40), status: '' };
  const groups = ['tooltip', 'select', 'old-cli'];
  return {
    kind: 'installed-public-consumer-pipeline',
    candidate,
    status: 'passed',
    finishedAt: '2026-11-23T00:00:00Z',
    rows: [
      'pack',
      ...groups.map((group) => group + '-preparation'),
      ...groups.map((group) => group + '-native'),
    ].map((name) => ({ name, status: 'passed' })),
    sourceBefore: source,
    sourceAfter: { ...source },
    helpersBefore: { owner: 'same' },
    helpersAfter: { owner: 'same' },
    node: 'v24.22.3',
  };
}

test('a claimed passed aggregate cannot hide a failed or unrun native group', () => {
  assert.doesNotThrow(() => checkPipelineTerminal(terminal(), candidate));
  for (const status of ['failed', 'not-run', 'running']) {
    const report = terminal();
    report.rows[6].status = status;
    assert.throws(() => checkPipelineTerminal(report, candidate), /failed or unrun stage/);
  }
});

test('omitting an independent group or changing candidate/helper evidence cannot pass', () => {
  const omitted = terminal();
  omitted.rows.pop();
  assert.throws(() => checkPipelineTerminal(omitted, candidate), /stage inventory/);
  const source = terminal();
  source.sourceAfter.head = 'c'.repeat(40);
  assert.throws(() => checkPipelineTerminal(source, candidate), /candidate source drifted/);
  const helper = terminal();
  helper.helpersAfter.owner = 'changed';
  assert.throws(() => checkPipelineTerminal(helper, candidate), /owner helpers drifted/);
  const runtime = terminal();
  runtime.node = 'v26.13.0';
  assert.throws(() => checkPipelineTerminal(runtime, candidate), /Node 24/);
});
