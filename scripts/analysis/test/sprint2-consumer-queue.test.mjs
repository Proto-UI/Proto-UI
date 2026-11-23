import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  runProcess,
  runQueue,
  summarizeReceipt,
  SPRINT2_SUITES,
} from '../run-sprint2-consumers.mjs';

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

test('a full count in one host cannot substitute for missing family/host/scenario cells', () => {
  const suite = SPRINT2_SUITES.find((item) => item.id === 'input');
  const cases = Array.from({ length: 72 }, (_, index) => ({
    family: 'base',
    runtime: 'wc',
    kind: 'input-otp',
    scenario: `unadmitted-${index}`,
    status: 'passed',
  }));
  assert.throws(
    () => summarizeReceipt(suite, { cases }),
    /each admitted family\/host\/kind\/scenario/
  );
});

test('a full Vitest count cannot replace the admitted generated consumer identities', () => {
  const suite = SPRINT2_SUITES.find((item) => item.id === 'compiled-consumers');
  const receipt = (names) => ({
    testResults: [{ assertionResults: names.map((fullName) => ({ fullName, status: 'passed' })) }],
  });
  assert.throws(
    () =>
      summarizeReceipt(
        suite,
        receipt(Array.from({ length: 20 }, (_, n) => `react/base: unadmitted ${n}`))
      ),
    /each admitted generated consumer/
  );
  assert.equal(summarizeReceipt(suite, receipt(suite.expectedIds)).passed, 20);
});

test(
  'timeout retires an ignoring descendant even after its group leader exits',
  { skip: process.platform !== 'linux' },
  async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'sprint2-queue-retirement-'));
    const pidFile = path.join(cwd, 'descendant.pid');
    const descendant = `process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const leader = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'inherit' }); process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);`;
    let pid;
    try {
      const result = await runProcess(process.execPath, ['-e', leader], {
        cwd,
        env: process.env,
        log: path.join(cwd, 'timeout.log'),
        timeoutMs: 500,
        timeoutGraceMs: 150,
      });
      pid = Number(await readFile(pidFile, 'utf8'));
      assert.equal(result.timeout, true);
      assert.equal(result.code, 0, 'the leader exited gracefully before group retirement');
      // A reparented zombie is already dead and cannot consume the next suite's resources.
      let state;
      for (let attempt = 0; attempt < 20; attempt++) {
        const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch((error) => {
          if (error.code !== 'ENOENT') throw error;
          return null;
        });
        state = stat?.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
        if (!state || state === 'Z') break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(!state || state === 'Z', `descendant survived the group deadline: ${state}`);
    } finally {
      if (!pid) pid = Number(await readFile(pidFile, 'utf8').catch(() => '0'));
      if (pid)
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          /* already retired */
        }
    }
  }
);
