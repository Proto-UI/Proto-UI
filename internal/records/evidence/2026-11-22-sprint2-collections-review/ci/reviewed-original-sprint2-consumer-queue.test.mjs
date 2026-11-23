import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runProcess, runQueue, summarizeReceipt } from '../run-sprint2-consumers.mjs';

test('a real failed child retains its receipt and does not suppress independent later work', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'sprint2-queue-negative-'));
  const snapshots = [];
  const results = await runQueue(
    [
      { id: 'failed', code: 3 },
      { id: 'independent', code: 0 },
      { id: 'dependent', code: 0, requires: ['failed'] },
    ],
    async (step) => {
      const result = await runProcess(
        process.execPath,
        ['-e', `console.log(${JSON.stringify(step.id)}); process.exit(${step.code})`],
        { cwd, env: process.env, log: path.join(cwd, step.id + '.log') }
      );
      return { status: result.code === 0 ? 'passed' : 'failed', process: result };
    },
    async (results) => {
      snapshots.push(structuredClone(results));
    }
  );
  assert.deepEqual(
    results.map(({ id, status }) => ({ id, status })),
    [
      { id: 'failed', status: 'failed' },
      { id: 'independent', status: 'passed' },
      { id: 'dependent', status: 'not-run' },
    ]
  );
  assert.equal(results[0].process.code, 3);
  assert.equal(await readFile(path.join(cwd, 'independent.log'), 'utf8'), 'independent\n');
  assert.ok(
    snapshots.some((items) => items[0].status === 'failed' && items[1]?.status === 'running')
  );
});

test('empty, partial, duplicate and selected-skipped receipts cannot become full acceptance', () => {
  const suite = { format: 'vitest', expectedCases: 2, pattern: '^admitted ' };
  const receipt = (assertionResults) => ({ testResults: [{ assertionResults }] });
  assert.throws(() => summarizeReceipt(suite, receipt([])), /selected inventory/);
  assert.throws(
    () => summarizeReceipt(suite, receipt([{ fullName: 'admitted first', status: 'passed' }])),
    /selected inventory/
  );
  assert.throws(
    () =>
      summarizeReceipt(
        suite,
        receipt(Array(2).fill({ fullName: 'admitted same', status: 'passed' }))
      ),
    /duplicate/
  );
  const summary = summarizeReceipt(
    suite,
    receipt([
      { fullName: 'admitted first', status: 'passed' },
      { fullName: 'admitted second', status: 'pending' },
      { fullName: 'experimental third', status: 'pending' },
    ])
  );
  assert.equal(summary.passed, 1);
  assert.equal(summary.incomplete, 1);
  assert.equal(summary.notSelected, 1);
});
