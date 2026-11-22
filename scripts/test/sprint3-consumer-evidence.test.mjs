import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  SPRINT3_SUITES,
  finishIncomplete,
  finalize,
  resolveEvidenceDirectory,
  runCommand,
  sealProductionArtifact,
  sourceProblems,
  startOwnedPreview,
  vitestProblems,
} from './sprint3-consumer-evidence.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');

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
    // This resource deadline includes process startup, so JavaScript need not
    // have run. The preceding independent command test proves log retention.
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

test('an outside symlink cannot place a new evidence child inside the source checkout', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3-canonical-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source');
  const ignored = path.join(source, 'ignored-build');
  mkdirSync(ignored, { recursive: true });
  const alias = path.join(directory, 'outside-alias');
  symlinkSync(ignored, alias, 'dir');
  assert.throws(
    () => resolveEvidenceDirectory(path.join(alias, 'not-created', 'run'), source),
    /outside/
  );
  const sourceAlias = path.join(directory, 'source-alias');
  symlinkSync(source, sourceAlias, 'dir');
  assert.throws(
    () => resolveEvidenceDirectory(path.join(source, 'evidence'), sourceAlias),
    /outside/
  );
  assert.equal(
    resolveEvidenceDirectory(path.join(directory, 'new', 'run'), sourceAlias),
    path.join(directory, 'new', 'run')
  );
});

function retainedEvidence(t) {
  const output = mkdtempSync(path.join(tmpdir(), 'sprint3-retained-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  const directory = path.join(output, 'sample');
  const captures = path.join(directory, 'captures');
  mkdirSync(captures, { recursive: true });
  const image = Buffer.from('diagnostic bytes: integrity fixture, not a browser image');
  writeFileSync(path.join(captures, 'state.png'), image);
  const reportBytes = JSON.stringify(report());
  writeFileSync(path.join(directory, 'vitest.json'), reportBytes);
  writeFileSync(path.join(directory, 'browser.log'), 'native process log');
  writeFileSync(path.join(directory, 'source.json'), '{"source":"fixture"}');
  const source = {
    head: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    worktreeStatus: '',
    lockSha256: 'c'.repeat(64),
    runnerSha256: 'd'.repeat(64),
  };
  const ledger = {
    expectedHead: source.head,
    source,
    errors: [],
    limits: [],
    build: { status: 'passed' },
    suites: [
      {
        id: 'sample',
        cases: 2,
        status: 'passed',
        screenshots: true,
        artifacts: [{ file: 'state.png', bytes: image.length, sha256: sha(image) }],
        reportSha256: sha(reportBytes),
        logSha256: sha('native process log'),
        sourceReceiptSha256: sha('{"source":"fixture"}'),
      },
    ],
  };
  for (const [name, bytes] of [
    ['build.log', 'completed production build\n'],
    ['dist-files.json', '[{"file":"en/index.html","bytes":8,"sha256":"fixture"}]\n'],
    ['preview-requests.jsonl', '{"method":"GET","url":"/en/","status":200}\n'],
  ]) {
    writeFileSync(path.join(output, name), bytes);
    sealProductionArtifact(output, ledger, name);
  }
  const run = () => finalize(output, ledger, false, () => source);
  const stored = () => JSON.parse(readFileSync(path.join(output, 'results.json'), 'utf8'));
  assert.equal(run(), 0, 'unchanged retained artifacts are the positive control');
  assert.equal(stored().status, 'passed');
  return { output, directory, captures, image, ledger, run, stored };
}

test('changed or deleted successful screenshots invalidate the persisted receipt', (t) => {
  const changed = retainedEvidence(t);
  const original = structuredClone(changed.ledger.suites[0].artifacts);
  writeFileSync(path.join(changed.captures, 'state.png'), 'changed capture');
  assert.equal(changed.run(), 1);
  assert.equal(changed.stored().status, 'failed');
  assert.equal(changed.stored().suites[0].status, 'failed');
  assert.deepEqual(changed.stored().suites[0].artifacts, original);
  assert.notDeepEqual(changed.stored().suites[0].observedArtifacts, original);
  assert.match(changed.stored().suites[0].evidenceProblems.join('\n'), /inventory drifted/);
  writeFileSync(path.join(changed.captures, 'state.png'), changed.image);
  assert.equal(changed.run(), 1, 'restoring bytes does not erase the recorded failure');
  const deleted = retainedEvidence(t);
  rmSync(path.join(deleted.captures, 'state.png'));
  assert.equal(deleted.run(), 1);
  assert.match(
    deleted.stored().suites[0].evidenceProblems.join('\n'),
    /Required native screenshots are missing/
  );
});

test('changed or missing Vitest, source and log bytes cannot retain a green outcome', (t) => {
  for (const file of ['vitest.json', 'source.json', 'browser.log']) {
    const f = retainedEvidence(t);
    writeFileSync(path.join(f.directory, file), 'replaced original bytes');
    assert.equal(f.run(), 1);
    assert.match(f.stored().suites[0].evidenceProblems.join('\n'), /hash drifted/);
    assert.equal(f.stored().status, 'failed');
  }
  const f = retainedEvidence(t);
  rmSync(path.join(f.directory, 'vitest.json'));
  assert.equal(f.run(), 1);
  assert.match(f.stored().suites[0].evidenceProblems.join('\n'), /vitest.json unavailable/);
});

test('a final capture symlink or unreadable receipt persists failure and keeps readable observations', (t) => {
  const f = retainedEvidence(t);
  symlinkSync(path.join(f.directory, 'browser.log'), path.join(f.captures, 'unowned.png'));
  assert.equal(f.run(), 1);
  const saved = f.stored();
  assert.equal(saved.status, 'failed');
  assert.equal(saved.suites[0].status, 'failed');
  assert.match(saved.suites[0].evidenceProblems.join('\n'), /symbolic link/);
  assert.equal(saved.suites[0].observedArtifacts.length, 1);
  const unreadable = retainedEvidence(t);
  rmSync(path.join(unreadable.directory, 'browser.log'));
  mkdirSync(path.join(unreadable.directory, 'browser.log'));
  assert.equal(unreadable.run(), 1);
  assert.equal(unreadable.stored().status, 'failed');
  assert.match(unreadable.stored().suites[0].evidenceProblems.join('\n'), /owned regular receipt/);
});

test('final result-write failure cannot leave the earlier successful aggregate', (t) => {
  const f = retainedEvidence(t);
  rmSync(path.join(f.directory, 'result.json'));
  mkdirSync(path.join(f.directory, 'result.json'));
  assert.equal(f.run(), 1);
  assert.equal(f.stored().status, 'failed');
  assert.match(f.stored().errors.join('\n'), /result receipt I\/O failure/);
});

test('missing or changed build, dist and preview receipts invalidate the persisted aggregate', (t) => {
  for (const name of ['build.log', 'dist-files.json', 'preview-requests.jsonl']) {
    for (const mutation of ['delete', 'change']) {
      const f = retainedEvidence(t);
      const original = structuredClone(f.ledger.productionArtifacts);
      const file = path.join(f.output, name);
      const bytes = readFileSync(file);
      if (mutation === 'delete') rmSync(file);
      else writeFileSync(file, 'changed production evidence');
      assert.equal(f.run(), 1, `${name}: ${mutation}`);
      const saved = f.stored();
      assert.equal(saved.status, 'failed');
      assert.match(
        saved.productionEvidenceProblems.join('\n'),
        new RegExp(name.replaceAll('.', '\\.'))
      );
      assert.deepEqual(saved.productionArtifacts, original, 'first sealed hashes remain intact');
      writeFileSync(file, bytes);
      assert.equal(f.run(), 1, 'restoring production bytes must not erase recorded failure');
    }
  }
});

test('production receipts cannot be resealed or replaced by unowned or unreadable files', (t) => {
  const f = retainedEvidence(t);
  assert.throws(() => sealProductionArtifact(f.output, f.ledger, 'build.log'), /already sealed/);
  for (const mutation of ['symlink', 'directory', 'unsealed']) {
    const f = retainedEvidence(t);
    const file = path.join(f.output, 'dist-files.json');
    if (mutation === 'unsealed') delete f.ledger.productionArtifacts['dist-files.json'];
    else {
      rmSync(file);
      if (mutation === 'symlink') symlinkSync(path.join(f.output, 'build.log'), file);
      else mkdirSync(file);
    }
    assert.equal(f.run(), 1, mutation);
    assert.equal(f.stored().status, 'failed');
    assert.match(f.stored().productionEvidenceProblems.join('\n'), /dist-files.json/);
    assert.ok(
      f.stored().observedProductionArtifacts['build.log'],
      'readable receipts remain available'
    );
  }
});
