import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  SPRINT3_SUITES,
  finishIncomplete,
  runCommand,
  sourceProblems,
  startOwnedPreview,
  vitestProblems,
} from './sprint3-consumer-evidence.mjs';

const report = () => ({
  success: true,
  numTotalTests: 2,
  numPassedTests: 2,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [{ assertionResults: [{ status: 'passed' }, { status: 'passed' }] }],
});

test('a zero exit is insufficient without the complete real case inventory', () => {
  assert.deepEqual(vitestProblems(report(), 2), []);
  for (const changed of [
    null,
    { ...report(), numTotalTests: 1, numPassedTests: 1 },
    { ...report(), numPendingTests: 1 },
    { ...report(), numTodoTests: 1 },
    { ...report(), success: false },
    { ...report(), testResults: [] },
    { ...report(), testResults: {} },
    {
      ...report(),
      testResults: [{ assertionResults: [{ status: 'passed' }, { status: 'skipped' }] }],
    },
    {
      ...report(),
      testResults: [{ assertionResults: [{ status: 'passed' }, { status: 'todo' }] }],
    },
  ])
    assert.ok(vitestProblems(changed, 2).length);
  const bound = report();
  bound.testResults[0].name = '/checkout/apps/www/test/native.browser.test.ts';
  assert.deepEqual(vitestProblems(bound, 2, 'apps/www/test/native.browser.test.ts'), []);
  assert.ok(vitestProblems(bound, 2, 'apps/www/test/another.browser.test.ts').length);
});

test('source binding rejects another head, dirty checkout, lock or input drift', () => {
  const source = {
    head: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    worktreeStatus: '',
    lockSha256: 'c'.repeat(64),
    runnerSha256: 'd'.repeat(64),
  };
  assert.deepEqual(sourceProblems(source, source), []);
  for (const patch of [
    { head: 'e'.repeat(40) },
    { tree: 'f'.repeat(40) },
    { worktreeStatus: ' M source.ts' },
    { lockSha256: '0'.repeat(64) },
    { runnerSha256: '1'.repeat(64) },
  ])
    assert.ok(sourceProblems({ ...source, ...patch }, source).length);
  assert.ok(sourceProblems(source, { head: undefined }).length);
});

test('interruption preserves earlier failures and marks every untouched suite blocked', () => {
  const ledger = {
    suites: [
      { status: 'passed', reason: 'original positive' },
      { status: 'failed', reason: 'original red' },
      { status: 'running' },
      { status: 'not-run' },
    ],
  };
  finishIncomplete(ledger, 'cancelled before next suite');
  assert.deepEqual(
    ledger.suites.map((entry) => entry.status),
    ['passed', 'failed', 'interrupted', 'blocked']
  );
  assert.equal(ledger.suites[1].reason, 'original red');
  assert.equal(ledger.suites[3].reason, 'cancelled before next suite');
  assert.equal(
    SPRINT3_SUITES.reduce((total, suite) => total + suite.cases, 0),
    364
  );
});

test('one process failure retains its log and does not prevent a later command', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3-command-'));
  try {
    const options = { cwd: directory, env: process.env, timeoutMs: 2_000, quiet: true };
    const failed = await runCommand(
      process.execPath,
      ['-e', 'console.error("original failure");process.exitCode=3'],
      { ...options, log: path.join(directory, 'failed.log') }
    );
    assert.equal(failed.exitCode, 3);
    assert.match(readFileSync(path.join(directory, 'failed.log'), 'utf8'), /original failure/);
    const passed = await runCommand(
      process.execPath,
      ['-e', 'console.log("independent terminal")'],
      { ...options, log: path.join(directory, 'passed.log') }
    );
    assert.equal(passed.exitCode, 0);
    assert.equal(passed.stopReason, null);
    assert.match(readFileSync(path.join(directory, 'passed.log'), 'utf8'), /independent terminal/);
    await assert.rejects(
      () =>
        runCommand(process.execPath, [], { ...options, log: path.join(directory, 'failed.log') }),
      /EEXIST/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a resource deadline is retained separately from an assertion failure', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3-deadline-'));
  try {
    const result = await runCommand(
      process.execPath,
      ['-e', 'console.log("entered");setInterval(()=>{},1000)'],
      {
        cwd: directory,
        env: process.env,
        timeoutMs: 150,
        quiet: true,
        log: path.join(directory, 'deadline.log'),
      }
    );
    assert.equal(result.stopReason, 'resource-deadline');
    assert.notEqual(result.exitCode, 0);
    assert.match(readFileSync(path.join(directory, 'deadline.log'), 'utf8'), /entered/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('owned preview serves exact emitted bytes and releases its listener', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3-preview-'));
  const dist = path.join(directory, 'dist');
  mkdirSync(path.join(dist, 'en', 'demo'), { recursive: true });
  const html = '<!doctype html><h1>Authored emitted page</h1>';
  writeFileSync(path.join(dist, 'en', 'demo', 'index.html'), html);
  writeFileSync(path.join(dist, 'app.js'), 'export const value=1;');
  writeFileSync(path.join(directory, 'private.txt'), 'outside static root');
  const log = path.join(directory, 'preview.jsonl');
  const server = await startOwnedPreview(dist, 'a'.repeat(40), log);
  try {
    const page = await fetch(`${server.url}/en/demo/`);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), html);
    assert.equal(page.headers.get('x-proto-ui-evidence-source'), 'a'.repeat(40));
    assert.match(page.headers.get('content-type'), /text\/html/);
    const module = await fetch(`${server.url}/app.js`);
    assert.match(module.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${server.url}/en/demo`, { redirect: 'manual' })).status, 301);
    assert.equal((await fetch(`${server.url}/%2e%2e%2fprivate.txt`)).status, 403);
    assert.equal((await fetch(`${server.url}/missing`)).status, 404);
    assert.equal((await fetch(`${server.url}/app.js`, { method: 'POST' })).status, 405);
    assert.ok(readFileSync(log, 'utf8').split('\n').filter(Boolean).length >= 6);
  } finally {
    await server.close();
  }
  try {
    await assert.rejects(fetch(`${server.url}/en/demo/`));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
