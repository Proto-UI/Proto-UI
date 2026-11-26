import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir as osTmpdir } from 'node:os';

const tmpdir = () => realpathSync(osTmpdir());
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
import {
  SOURCE_CANARY_MODULES,
  SOURCE_CANARY_SUITE,
  createOwnedSourceServer,
  inspectSourceCanary,
  sourceServerHash,
  suiteOrigins,
} from './sprint3-source-server.mjs';

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

test('only the controls row receives the owned source origin; caller origins never survive', () => {
  const caller = {
    NODE_ENV: 'production',
    PROTO_UI_BROWSER_BASE_URL: 'https://unowned.invalid',
    PROTO_UI_BROWSER_SOURCE_BASE_URL: 'https://unowned-source.invalid',
  };
  for (const row of SPRINT3_SUITES) {
    const env = suiteOrigins(caller, row, 'http://127.0.0.1:3001', 'http://127.0.0.1:3002');
    assert.equal(
      env.PROTO_UI_BROWSER_BASE_URL,
      row.surface === 'production-docs' ? 'http://127.0.0.1:3001' : undefined
    );
    assert.equal(
      env.PROTO_UI_BROWSER_SOURCE_BASE_URL,
      row.id === SOURCE_CANARY_SUITE ? 'http://127.0.0.1:3002' : undefined
    );
    assert.equal(env.NODE_ENV, 'production');
  }
  assert.equal(caller.PROTO_UI_BROWSER_SOURCE_BASE_URL, 'https://unowned-source.invalid');
  const controls = SPRINT3_SUITES.find((row) => row.id === SOURCE_CANARY_SUITE);
  for (const url of [
    undefined,
    '',
    'https://example.test',
    'http://localhost:3000',
    'http://127.0.0.1:3000/path',
  ])
    assert.throws(() => suiteOrigins(caller, controls, 'http://127.0.0.1:3001', url));
  assert.throws(() => suiteOrigins(caller, controls, undefined, 'http://127.0.0.1:3002'));
  assert.throws(() =>
    suiteOrigins(caller, controls, 'http://127.0.0.1:3001', 'http://127.0.0.1:3001')
  );
});

// Synthetic Astro API + real Node child/IPC/HTTP/process cleanup. This tests the
// producer contract without running Astro, Chromium, a build or native cases.
const generatedPaintInputs = [
  'src/styles/proto-ui-style.css',
  'src/styles/proto-ui-tokens.generated.css',
  'src/styles/shadcn-theme.css',
  'src/styles/proto-ui-shadow-style.generated.js',
];

function sourceFixture(t, mode = 'normal', options = {}) {
  const { launch = true, ...serverOptions } = options;
  const folder = mkdtempSync(path.join(tmpdir(), 'sprint3-source-unit-'));
  const root = path.join(folder, 'www');
  const directory = path.join(folder, 'evidence');
  const packageDirectory = path.join(root, 'node_modules/astro');
  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  writeFileSync(path.join(root, 'astro.config.mjs'), 'export default {};\n');
  for (const file of [...generatedPaintInputs, 'src/generated/shadcn-motion-palette.ts']) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), 'synthetic generated input for producer integrity only');
  }
  for (const module of SOURCE_CANARY_MODULES) {
    const file = path.join(root, module.slice(1));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'export const source = "synthetic unit input";\n');
  }
  writeFileSync(
    path.join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: 'astro',
      version: '0.0.0-synthetic-unit-only',
      type: 'module',
      exports: { '.': './index.mjs', './package.json': './package.json' },
    })
  );
  writeFileSync(
    path.join(packageDirectory, 'index.mjs'),
    `
    import { createServer } from 'node:http';
    import { EventEmitter } from 'node:events';
    import { spawn } from 'node:child_process';
    const mode = ${JSON.stringify(mode)};
    export async function dev(config) {
      process.env.NODE_ENV = 'synthetic-child-development';
      if (process.env.PROTO_UI_BROWSER_SOURCE_BASE_URL || process.env.PROTO_UI_BROWSER_BASE_URL)
        throw new Error('caller URL leaked into child');
      console.log('SYNTHETIC_ASTRO_OPTIONS', JSON.stringify(config));
      if (mode === 'startup-fail') throw new Error('synthetic startup failure');
      if (mode === 'startup-hang') await new Promise(() => {});
      if (mode === 'orphan-descendant') {
        const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { stdio: 'ignore' });
        console.log('SYNTHETIC_DESCENDANT_PID', descendant.pid);
      }
      const middleware = [];
      const httpServer = createServer((request, response) => {
        let index = 0;
        const next = () => {
          if (middleware[index]) return middleware[index++](request, response, next);
          if (request.url === '/__exit') return process.exit(9);
          const module = request.url.startsWith('/src/');
          response.writeHead(mode === 'missing-module' && module ? 404 : 200, {
            'Content-Type': module && mode !== 'html-fallback' ? 'application/javascript' : 'text/html',
          });
          response.end(module && mode !== 'html-fallback' ? 'export const synthetic = true;' : '<html>Synthetic unit document</html>');
        };
        next();
      });
      for (const plugin of config.vite.plugins) plugin.configureServer({ httpServer, middlewares: { use: (fn) => middleware.push(fn) } });
      await new Promise((resolve) => httpServer.listen(config.server.port, config.server.host, resolve));
      return {
        address: httpServer.address(), watcher: new EventEmitter(),
        async stop() {
          console.log('SYNTHETIC_STOP_ENTER');
          if (mode === 'stop-fail') throw new Error('synthetic stop failure');
          await new Promise((resolve, reject) => {
            httpServer.close((error) => error ? reject(error) : resolve());
            httpServer.closeAllConnections();
          });
          console.log('SYNTHETIC_STOP_COMPLETE');
        },
      };
    }
  `
  );
  const source = { head: 'a'.repeat(40), sourceServerSha256: sourceServerHash() };
  const configuration = {
    root,
    directory,
    source,
    deadline: Date.now() + 20_000,
    startupMs: 5_000,
    stopGraceMs: 500,
    ...serverOptions,
  };
  let owner;
  t.after(async () => {
    await owner?.close();
    rmSync(folder, { recursive: true, force: true });
  });
  if (launch) owner = createOwnedSourceServer(configuration);
  return { folder, root, directory, source, owner, configuration };
}

test('owned source child supplies IPC origin, probes modules, isolates NODE_ENV and seals after stop', async (t) => {
  const before = process.env.NODE_ENV;
  const f = sourceFixture(t);
  const binding = await f.owner.ready();
  assert.match(binding.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(binding.astro.version, '0.0.0-synthetic-unit-only');
  assert.equal(binding.evidenceKind, 'supplemental-source-canary');
  assert.equal(process.env.NODE_ENV, before);
  const receipt = await f.owner.close();
  assert.equal(await f.owner.close(), receipt, 'close is idempotent and never reseals');
  assert.equal(receipt.status, 'passed', JSON.stringify(receipt));
  assert.equal(receipt.terminal.groupRetired, true);
  assert.equal(receipt.terminal.cacheRetired, true);
  assert.match(
    readFileSync(path.join(f.directory, 'server.log'), 'utf8'),
    /SYNTHETIC_STOP_COMPLETE/
  );
  const metadata = JSON.parse(readFileSync(path.join(f.directory, 'server.json'), 'utf8'));
  assert.equal(metadata.nodeEnv, 'synthetic-child-development');
  assert.equal(metadata.address.port, Number(new URL(binding.url).port));
  const probes = JSON.parse(readFileSync(path.join(f.directory, 'probes.json'), 'utf8'));
  assert.equal(probes.length, 3);
  assert.ok(probes.every((probe) => probe.outcome === 'available' && probe.sha256.length === 64));
  assert.deepEqual(inspectSourceCanary(f.directory, receipt, f.source).problems, []);
  await assert.rejects(fetch(binding.url));
});

test('source startup failure, HTML fallback and missing modules remain failed evidence', async (t) => {
  for (const mode of ['startup-fail', 'html-fallback', 'missing-module']) {
    const f = sourceFixture(t, mode);
    await assert.rejects(f.owner.ready());
    const receipt = await f.owner.close();
    assert.equal(receipt.status, 'failed', mode);
    assert.equal(receipt.terminal.groupRetired, true, mode);
    assert.ok(inspectSourceCanary(f.directory, receipt, f.source).problems.length > 0);
  }
});

test('startup resource deadline forcibly retires a child stuck inside the dev API', async (t) => {
  const f = sourceFixture(t, 'startup-hang', { startupMs: 100, stopGraceMs: 100 });
  await assert.rejects(f.owner.ready(), /resource deadline/);
  const receipt = await f.owner.close();
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.terminal.forced, true);
  assert.equal(receipt.terminal.groupRetired, true);
});

test('unexpected source exit and abort cannot become successful production evidence', async (t) => {
  const crashed = sourceFixture(t);
  const binding = await crashed.owner.ready();
  await assert.rejects(fetch(`${binding.url}/__exit`));
  await new Promise((resolve) =>
    crashed.owner.failureSignal.aborted
      ? resolve()
      : crashed.owner.failureSignal.addEventListener('abort', resolve, { once: true })
  );
  const receipt = await crashed.owner.close();
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.terminal.exitCode, 9);
  assert.equal(receipt.terminal.groupRetired, true);
  const abort = new AbortController();
  const cancelled = sourceFixture(t, 'normal', { signal: abort.signal });
  await cancelled.owner.ready();
  abort.abort();
  assert.equal((await cancelled.owner.close()).status, 'failed');
});

test('the existing suite deadline includes startup and source cleanup', async (t) => {
  const f = sourceFixture(t, 'normal', { deadline: Date.now() + 2_000, stopGraceMs: 100 });
  await f.owner.ready();
  await new Promise((resolve) =>
    f.owner.failureSignal.aborted
      ? resolve()
      : f.owner.failureSignal.addEventListener('abort', resolve, { once: true })
  );
  const receipt = await f.owner.close();
  assert.equal(receipt.status, 'failed');
  assert.match(receipt.terminal.problems.join('\n'), /resource deadline/);
  assert.equal(receipt.terminal.groupRetired, true);
  const blocked = sourceFixture(t, 'normal', { launch: false });
  assert.throws(
    () => createOwnedSourceServer({ ...blocked.configuration, deadline: Date.now() + 50 }),
    /budget remains/
  );
});

test('a source child independently retires its group after owner loss while pending or ready', async (t) => {
  for (const mode of ['startup-hang', 'orphan-descendant']) {
    const f = sourceFixture(t, mode, { launch: false, stopGraceMs: 100 });
    const pidFile = path.join(f.folder, 'orphan-pid.json');
    const program = `
      import { createOwnedSourceServer } from ${JSON.stringify(new URL('./sprint3-source-server.mjs', import.meta.url).href)};
      import { readFileSync, writeFileSync } from 'node:fs';
      const owner = createOwnedSourceServer(${JSON.stringify(f.configuration)});
      const result = { pid: owner.pid };
      if (${JSON.stringify(mode)} === 'orphan-descendant') result.binding = await owner.ready();
      const deadline = Date.now() + 2_000;
      let log;
      while (!(log = readFileSync(${JSON.stringify(path.join(f.directory, 'server.log'))}, 'utf8')).includes('SYNTHETIC_ASTRO_OPTIONS')) {
        if (Date.now() >= deadline) throw new Error('Synthetic dev API was not entered.');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const marker = log.split('\\n').find((line) => line.startsWith('SYNTHETIC_DESCENDANT_PID '));
      if (marker) result.descendantPid = Number(marker.split(' ')[1]);
      writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify(result));
      process.exit(0);
    `;
    const result = await runCommand(process.execPath, ['--input-type=module', '-e', program], {
      cwd: f.folder,
      env: process.env,
      log: path.join(f.folder, 'owner.log'),
      timeoutMs: 5_000,
      quiet: true,
    });
    assert.equal(result.exitCode, 0);
    const info = JSON.parse(readFileSync(pidFile, 'utf8'));
    const pids = [info.pid, ...(mode === 'orphan-descendant' ? [info.descendantPid] : [])];
    assert.ok(pids.every((pid) => Number.isInteger(pid) && pid > 0));
    t.after(() => {
      try {
        process.kill(-info.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    });
    const running = (pid) => {
      try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
        // A reparented zombie cannot execute or hold a listener; init owns reaping.
        return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0] !== 'Z';
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return false;
      }
    };
    for (let attempt = 0; attempt < 100 && pids.some(running); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(
      pids.filter(running),
      [],
      `${mode}: no child or descendant may survive owner loss`
    );
    if (info.binding) await assert.rejects(fetch(info.binding.url));
  }
});

test('stop errors and source input drift remain terminal failures', async (t) => {
  const broken = sourceFixture(t, 'stop-fail');
  await broken.owner.ready();
  const receipt = await broken.owner.close();
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.terminal.exitCode, 1);
  const changed = sourceFixture(t);
  await changed.owner.ready();
  writeFileSync(path.join(changed.root, SOURCE_CANARY_MODULES[0].slice(1)), 'changed source');
  assert.match((await changed.owner.close()).terminal.problems.join('\n'), /Source input changed/);
});

test('generated style prerequisites are required and start/end digest drift fails the producer', async (t) => {
  for (const file of generatedPaintInputs) {
    const changed = sourceFixture(t);
    await changed.owner.ready();
    writeFileSync(path.join(changed.root, file), 'changed generated paint source');
    const receipt = await changed.owner.close();
    assert.equal(receipt.status, 'failed', file);
    assert.match(receipt.terminal.problems.join('\n'), /Source input changed/);
    const missing = sourceFixture(t, 'normal', { launch: false });
    rmSync(path.join(missing.root, file));
    let unexpectedOwner;
    t.after(async () => {
      await unexpectedOwner?.close();
    });
    assert.throws(
      () => {
        unexpectedOwner = createOwnedSourceServer(missing.configuration);
      },
      undefined,
      file
    );
  }
});

test('source-canary finalization rejects modified, missing, aliased and unsealed receipts', async (t) => {
  const f = sourceFixture(t);
  await f.owner.ready();
  const receipt = await f.owner.close();
  assert.deepEqual(inspectSourceCanary(f.directory, receipt, f.source).problems, []);
  for (const name of Object.keys(receipt.artifacts)) {
    const file = path.join(f.directory, name);
    const original = readFileSync(file);
    for (const mutation of ['changed', 'missing', 'symlink']) {
      rmSync(file);
      if (mutation === 'changed') writeFileSync(file, 'changed receipt');
      if (mutation === 'symlink') symlinkSync(path.join(f.root, 'astro.config.mjs'), file);
      assert.ok(
        inspectSourceCanary(f.directory, receipt, f.source).problems.some((problem) =>
          problem.includes(name)
        ),
        `${name}: ${mutation}`
      );
      rmSync(file, { force: true });
      writeFileSync(file, original);
    }
    const unsealed = structuredClone(receipt);
    delete unsealed.artifacts[name];
    assert.ok(
      inspectSourceCanary(f.directory, unsealed, f.source).problems.some((problem) =>
        problem.includes(name)
      )
    );
  }
  assert.ok(
    inspectSourceCanary(f.directory, receipt, { ...f.source, head: 'b'.repeat(40) }).problems.some(
      (problem) => problem.includes('source binding')
    )
  );
});

test('aggregate finalization requires supplemental source proof for an otherwise green controls row', async (t) => {
  const f = retainedEvidence(t);
  const row = f.ledger.suites[0];
  row.id = SOURCE_CANARY_SUITE;
  const directory = path.join(f.output, SOURCE_CANARY_SUITE);
  renameSync(f.directory, directory);
  const source = sourceFixture(t);
  await source.owner.ready();
  row.sourceCanary = await source.owner.close();
  f.ledger.source.sourceServerSha256 = source.source.sourceServerSha256;
  mkdirSync(path.join(directory, 'source-canary'));
  for (const name of Object.keys(row.sourceCanary.artifacts))
    writeFileSync(
      path.join(directory, 'source-canary', name),
      readFileSync(path.join(source.directory, name))
    );
  assert.equal(f.run(), 0, 'complete producer evidence is a positive aggregate control');
  const original = structuredClone(row.sourceCanary.artifacts);
  writeFileSync(path.join(directory, 'source-canary/server.log'), 'changed source log');
  assert.equal(f.run(), 1);
  assert.match(f.stored().suites[0].evidenceProblems.join('\n'), /server.log source-canary hash/);
  assert.deepEqual(f.stored().suites[0].sourceCanary.artifacts, original);
  writeFileSync(
    path.join(directory, 'source-canary/server.log'),
    readFileSync(path.join(source.directory, 'server.log'))
  );
  assert.equal(f.run(), 1, 'restoring bytes must not erase the retained failure');
  delete row.sourceCanary;
  assert.equal(f.run(), 1);
  assert.match(
    f.stored().suites[0].evidenceProblems.join('\n'),
    /Source canary producer did not pass/
  );
});
