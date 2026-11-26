import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CONSUMER_MATRICES,
  computeCounts,
  extractConsumerMatrixFromMarkdown,
  renderConsumerMatrix,
  runConsumerMatricesCli,
  validateConsumerMatrixData,
} from '../render-consumer-matrices.mjs';

test('live repository consumer matrices match their canonical JSON sources byte-for-byte', () => {
  const result = runConsumerMatricesCli(['--check']);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.summary.length, CONSUMER_MATRICES.length);
});

test('renderConsumerMatrix recalculates state and target-class totals automatically from rows', () => {
  const jsonPath = path.resolve(
    process.cwd(),
    'internal/agent-harness/dogfood-coverage-matrix.json'
  );
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const originalReady = computeCounts(data.rows, 'state', data.stateOrder).ready;
  const originalBlocked = computeCounts(data.rows, 'state', data.stateOrder).blocked;

  const mutated = structuredClone(data);
  const readyRow = mutated.rows.find((row) => row.state === 'ready');
  assert.ok(readyRow);
  readyRow.state = 'blocked';

  const rendered = renderConsumerMatrix(mutated);
  assert.match(rendered, new RegExp(`\\| ready\\s+\\|\\s+${originalReady - 1} \\|`));
  assert.match(rendered, new RegExp(`\\| blocked\\s+\\|\\s+${originalBlocked + 1} \\|`));

  const extracted = extractConsumerMatrixFromMarkdown(
    rendered,
    CONSUMER_MATRICES.find((item) => item.kind === 'agent-harness')
  );
  assert.equal(extracted.rows.find((row) => row.id === readyRow.id).state, 'blocked');
});

test('validateConsumerMatrixData rejects duplicate IDs, unknown states, and invalid sha256 bindings', () => {
  const jsonPath = path.resolve(
    process.cwd(),
    'internal/website/self-hosting-coverage-matrix.json'
  );
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const dup = structuredClone(data);
  dup.rows.push(structuredClone(dup.rows[0]));
  assert.ok(validateConsumerMatrixData(dup).some((msg) => msg.includes('duplicate row id')));

  const badState = structuredClone(data);
  badState.rows[0].state = 'shipped-by-magic';
  assert.ok(validateConsumerMatrixData(badState).some((msg) => msg.includes('invalid state')));

  const badSha = structuredClone(data);
  badSha.sourceBindings[0].sourceSha256 = 'not-a-sha256';
  assert.ok(validateConsumerMatrixData(badSha).some((msg) => msg.includes('invalid sha256')));
});

test('CLI --check fails closed on manual Markdown drift and --write restores sync', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pui-consumer-matrices-'));
  try {
    for (const spec of CONSUMER_MATRICES) {
      for (const rel of [spec.jsonPath, spec.markdownPath]) {
        const dst = path.join(tmpDir, rel);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(path.resolve(process.cwd(), rel), dst);
      }
    }

    assert.equal(runConsumerMatricesCli(['--check'], tmpDir).ok, true);

    const driftedMd = path.join(tmpDir, CONSUMER_MATRICES[0].markdownPath);
    fs.appendFileSync(driftedMd, '\nManual unbacked edit\n');

    const failed = runConsumerMatricesCli(['--check'], tmpDir);
    assert.equal(failed.ok, false);
    assert.ok(failed.errors.some((msg) => msg.includes('drifted from canonical JSON source')));

    const rewritten = runConsumerMatricesCli(['--write'], tmpDir);
    assert.equal(rewritten.ok, true, rewritten.errors.join('\n'));
    assert.equal(runConsumerMatricesCli(['--check'], tmpDir).ok, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
