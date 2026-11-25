import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir as osTmpdir } from 'node:os';

const tmpdir = () => realpathSync(osTmpdir());
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FOLLOWUP_SUITES,
  followupEnvironment,
  followupSuite,
  parseFollowupArguments,
} from './sprint3-followup-evidence.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const json = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));

// This fixture copies the actual verifier and its actual helper closure into a
// small committed Git root. Its success-shaped observations are synthetic
// controls only. These tests never run Vitest, Chrome or an installed consumer
// and never produce native acceptance evidence.
async function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 followup controls '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  mkdirSync(root);
  for (const file of [
    'scripts/test/sprint3-followup-evidence.mjs',
    'scripts/test/sprint3-consumer-evidence.mjs',
    'scripts/test/sprint3-source-server.mjs',
    'scripts/test/runtime-observation.mjs',
  ]) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repository, file), target);
  }
  for (const file of [
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    ...FOLLOWUP_SUITES.map((suite) => suite.file),
  ]) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, '// Synthetic source identity for verifier controls; never executed.\n');
  }
  json(path.join(root, 'package.json'), {
    name: 'sprint3-followup-negative-control',
    private: true,
    type: 'module',
    packageManager: 'pnpm@10.32.1',
  });
  writeFileSync(path.join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('config', 'user.name', 'Follow-up verifier fixture');
  git('config', 'user.email', 'fixture@invalid.example');
  git('add', '.');
  git('-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Synthetic verifier fixture');
  const candidate = git('rev-parse', 'HEAD');
  const owner = await import(
    pathToFileURL(path.join(root, 'scripts/test/sprint3-followup-evidence.mjs')).href
  );
  let serial = 0;
  function evidence(id = 'select-public-usage') {
    const suite = owner.followupSuite(id);
    const output = path.join(directory, 'evidence-' + ++serial);
    const ledger = owner.initializeFollowup(output, id, candidate);
    const raw = path.join(output, 'observed');
    const captures = path.join(raw, 'captures');
    mkdirSync(captures, { recursive: true });
    const report = {
      numTotalTests: suite.cases,
      numPassedTests: suite.cases,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      success: true,
      testResults: [
        {
          name: path.join(root, suite.file),
          assertionResults: Array.from({ length: suite.cases }, (_, index) => ({
            fullName: 'Synthetic verifier case ' + index,
            status: 'passed',
          })),
        },
      ],
    };
    json(path.join(raw, 'vitest.json'), report);
    json(path.join(raw, 'source.json'), {
      candidate,
      suite,
      before: ledger.source,
      after: ledger.source,
    });
    json(path.join(raw, 'execution.json'), {
      candidate,
      suite,
      invocation: owner.followupCommand(suite, output),
      node: process.version,
      packageManager: 'pnpm@10.32.1',
      result: {
        exitCode: 0,
        signal: null,
        stopReason: null,
        spawnError: null,
        ioError: null,
        elapsedMs: 1,
      },
      startedAt: '2000-01-01T00:00:00.000Z',
      finishedAt: '2000-01-01T00:00:00.001Z',
    });
    const capture = (file, contents = 'synthetic control, not a real image or video\n') =>
      writeFileSync(path.join(captures, file), contents);
    let log = 'Synthetic success-shaped observation for negative controls only.\n';
    if (id === 'drawer') {
      for (const scope of ['document', 'shadow'])
        for (const suffix of ['enter.png', 'trace.json', 'scroll.png', 'scroll-trace.json'])
          capture('drawer-' + scope + '-' + suffix);
      for (const kind of ['fixed-control', 'intrinsic'])
        for (const suffix of ['settled.png', 'diagnostic.json'])
          capture('drawer-public-' + kind + '-' + suffix);
    }
    if (id === 'image-preview') {
      for (const width of [320, 390, 1280])
        for (const color of ['light', 'dark'])
          for (const family of ['shadcn', 'brutalist'])
            for (const extension of ['json', 'png'])
              capture(width + '-' + color + '-' + family + '-last-observed.' + extension);
      capture('linear-390.webm');
      capture('linear-1280.webm');
      json(path.join(captures, 'matrix.json'), {
        candidate,
        browser: 'synthetic-control-not-Chrome',
      });
    }
    if (id === 'scroll') {
      for (const runtime of ['wc', 'react', 'vue', 'vue2'])
        for (const axis of ['vertical', 'horizontal']) {
          const label = runtime + '/' + axis + '-thumb-start';
          log +=
            '[shadcn-scroll-thumb-drag-geometry] ' +
            JSON.stringify({ label, box: { width: 12, height: 24 }, before: 0 }) +
            '\n';
          log +=
            '[shadcn-scroll-thumb-drag-hit] ' +
            JSON.stringify({ label, point: { x: 1, y: 1 }, hit: { onThumb: true } }) +
            '\n';
        }
    }
    writeFileSync(path.join(raw, 'runner.log'), log);
    ledger.producerStatus = 'finished';
    const seal = () => {
      ledger.artifacts = owner.followupInventory(raw);
      json(path.join(output, 'results.json'), ledger);
    };
    seal();
    return {
      id,
      suite,
      output,
      raw,
      captures,
      ledger,
      seal,
      verify: (steps) => owner.verifyFollowup(output, id, candidate, steps),
    };
  }
  return { root, directory, owner, candidate, evidence };
}

function rejected(result, pattern) {
  assert.equal(result.status, 'failed', JSON.stringify(result.problems));
  if (pattern) assert.match(result.problems.join('\n'), pattern);
}

test('entrypoint selects only complete original files and rejects extra selection or origin arguments', () => {
  assert.deepEqual(
    FOLLOWUP_SUITES.map(({ id, cases }) => [id, cases]),
    [
      ['drawer', 7],
      ['scroll', 1],
      ['image-preview', 32],
      ['select-public-usage', 4],
    ]
  );
  for (const suite of FOLLOWUP_SUITES)
    assert.equal(parseFollowupArguments(['run', '--suite', suite.id]).suite, suite);
  for (const args of [
    [],
    ['run'],
    ['run', '--suite', 'unknown'],
    ['run', '--suite', 'drawer', '--grep', 'visible'],
    ['run', '--suite', 'scroll', '--url', 'https://example.invalid'],
  ])
    assert.throws(() => parseFollowupArguments(args));
});

test('inherited caller origins and host or runtime selection fail before a child can start', () => {
  for (const name of [
    'PROTO_UI_BROWSER_BASE_URL',
    'PROTO_UI_BROWSER_SOURCE_BASE_URL',
    'PROTO_UI_SHADCN_SCROLL_AREA_BROWSER_RUNTIME',
    'PROTO_UI_RUNTIME_PHASE',
    'PROTO_UI_RUNTIME_SHARD',
    'PROTO_UI_RUNTIME_SELECTION_FILE',
    'PROTO_UI_RUNTIME_PROGRESS_FILE',
  ])
    assert.throws(
      () =>
        followupEnvironment(
          { [name]: 'caller-value' },
          followupSuite('scroll'),
          '/owned',
          'a'.repeat(40)
        ),
      /forbidden/
    );
  const result = followupEnvironment(
    {
      PATH: '/toolchain',
      CHROME_PATH: '/real/chrome',
      IMAGE_PREVIEW_EVIDENCE_DIR: '/foreign',
      PUI_FINF_FEATURE_EVIDENCE_DIR: '/foreign',
      PROTO_UI_RUNTIME_EVIDENCE_DIR: '/foreign',
    },
    followupSuite('image-preview'),
    '/owned/captures',
    'a'.repeat(40)
  );
  assert.equal(result.IMAGE_PREVIEW_EVIDENCE_DIR, '/owned/captures');
  assert.equal(result.PUI_FINF_FEATURE_EVIDENCE_DIR, undefined);
  assert.equal(result.PROTO_UI_RUNTIME_EVIDENCE_DIR, undefined);
  assert.equal(result.CHROME_PATH, '/real/chrome');
});

test('actual verifier accepts internally complete synthetic controls without rewriting producer bytes', async (t) => {
  const f = await fixture(t);
  for (const suite of FOLLOWUP_SUITES) {
    const e = f.evidence(suite.id);
    const before = readFileSync(path.join(e.output, 'results.json'));
    assert.equal(e.verify().status, 'passed', JSON.stringify(e.verify().problems));
    assert.deepEqual(readFileSync(path.join(e.output, 'results.json')), before);
  }
});

test('a success-shaped report cannot erase the original exit, signal, timeout, spawn or I/O failure', async (t) => {
  const f = await fixture(t);
  for (const mutation of [
    { exitCode: 1 },
    { signal: 'SIGTERM' },
    { stopReason: 'resource-deadline' },
    { stopReason: 'interrupted' },
    { spawnError: 'ENOENT' },
    { ioError: 'ENOSPC' },
    { elapsedMs: -1 },
  ]) {
    const e = f.evidence();
    const file = path.join(e.raw, 'execution.json');
    const execution = read(file);
    Object.assign(execution.result, mutation);
    json(file, execution);
    e.seal();
    rejected(e.verify(), /process exit/);
  }
});

test('actual candidate file, every assertion and complete counters are required', async (t) => {
  const f = await fixture(t);
  const mutations = [
    (report) => {
      report.testResults[0].name = '/other/checkout/' + followupSuite('select-public-usage').file;
    },
    (report) => {
      report.testResults[0].assertionResults.pop();
    },
    (report) => {
      report.testResults[0].assertionResults[0].status = 'skipped';
    },
    (report) => {
      report.numPendingTests = 1;
      report.numPassedTests = 3;
    },
    (report) => {
      report.numTotalTests = 3;
    },
    (report) => {
      report.testResults.push(report.testResults[0]);
    },
    (report) => {
      report.success = false;
    },
  ];
  for (const mutate of mutations) {
    const e = f.evidence();
    const file = path.join(e.raw, 'vitest.json');
    const report = read(file);
    mutate(report);
    json(file, report);
    e.seal();
    rejected(e.verify(), /Vitest|inventory|num/);
  }
});

test('producer status, original error and selected suite remain authoritative even with complete artifacts', async (t) => {
  const f = await fixture(t);
  for (const status of ['not-run', 'running', 'failed', 'interrupted']) {
    const e = f.evidence();
    e.ledger.producerStatus = status;
    e.seal();
    rejected(e.verify(), /producer did not finish/);
  }
  const withError = f.evidence();
  withError.ledger.producerErrors.push('Original setup failed');
  withError.seal();
  rejected(withError.verify(), /Original setup failed/);
  const otherPlan = f.evidence();
  otherPlan.ledger.suite = { ...otherPlan.ledger.suite, cases: 3 };
  otherPlan.seal();
  rejected(otherPlan.verify(), /suite plan differs/);
});

test('missing, same-length changed and symbolic-link artifacts cannot be silently resealed by finalization', async (t) => {
  const f = await fixture(t);
  const missing = f.evidence();
  rmSync(path.join(missing.raw, 'vitest.json'));
  rejected(missing.verify(), /artifact bytes or inventory changed/);
  const changed = f.evidence();
  const logFile = path.join(changed.raw, 'runner.log');
  const bytes = readFileSync(logFile);
  bytes[0] ^= 1;
  writeFileSync(logFile, bytes);
  rejected(changed.verify(), /artifact bytes or inventory changed/);
  const linked = f.evidence();
  const outside = path.join(f.directory, 'foreign-source.json');
  writeFileSync(outside, 'not valid JSON and must never be parsed through an alias');
  rmSync(path.join(linked.raw, 'source.json'));
  symlinkSync(outside, path.join(linked.raw, 'source.json'));
  const result = linked.verify();
  rejected(result, /symbolic link/);
  assert.doesNotMatch(result.problems.join('\n'), /cannot be verified/);
});

test('current, before and after source must be the original clean full candidate', async (t) => {
  const f = await fixture(t);
  for (const slot of ['before', 'after']) {
    const e = f.evidence();
    const file = path.join(e.raw, 'source.json');
    const source = read(file);
    source[slot] = { ...source[slot], checkoutSha: 'b'.repeat(40), dirty: true };
    json(file, source);
    e.seal();
    rejected(e.verify(), /candidate SHA|not clean|drifted/);
  }
  const e = f.evidence();
  rejected(f.owner.verifyFollowup(e.output, e.id, 'c'.repeat(40)), /candidate/);
  writeFileSync(path.join(f.root, e.suite.file), '// changed source\n');
  rejected(e.verify(), /not clean|drifted/);
});

test('each Drawer capture and Image matrix and video remain mandatory beyond a green test count', async (t) => {
  const f = await fixture(t);
  for (const [id, file] of [
    ['drawer', 'drawer-shadow-enter.png'],
    ['drawer', 'drawer-public-intrinsic-diagnostic.json'],
    ['image-preview', '320-light-shadcn-last-observed.png'],
    ['image-preview', 'linear-390.webm'],
  ]) {
    const e = f.evidence(id);
    rmSync(path.join(e.captures, file));
    e.seal();
    rejected(e.verify(), /capture missing|receipt\/video missing/);
  }
  const image = f.evidence('image-preview');
  json(path.join(image.captures, 'matrix.json'), {
    candidate: 'd'.repeat(40),
    browser: 'synthetic',
  });
  image.seal();
  rejected(image.verify(), /capture candidate or browser differs/);
});

test('one Scroll case must retain both axes of all four original host observations', async (t) => {
  const f = await fixture(t);
  for (const mutate of [
    (log) =>
      log
        .split('\n')
        .filter((line) => !line.includes('vue2/'))
        .join('\n'),
    (log) => log.replace('"onThumb":true', '"onThumb":false'),
    (log) => log.replace('"width":12', '"width":0'),
    (log) => log + log.split('\n').find((line) => line.includes('drag-hit')) + '\n',
  ]) {
    const e = f.evidence('scroll');
    const file = path.join(e.raw, 'runner.log');
    writeFileSync(file, mutate(readFileSync(file, 'utf8')));
    e.seal();
    rejected(e.verify(), /four-host Scroll observation/);
  }
});

test('always finalization also checks actual workflow stages instead of green-looking raw artifacts alone', async (t) => {
  const f = await fixture(t);
  const e = f.evidence();
  const ids = ['inventory', 'dependencies', 'controls', 'environment', 'public-source'];
  const good = Object.fromEntries(ids.map((id) => [id, { outcome: 'success' }]));
  assert.equal(e.verify(good).status, 'passed');
  for (const id of ids) {
    const steps = structuredClone(good);
    steps[id].outcome = 'failure';
    rejected(e.verify(steps), new RegExp('stage did not succeed: ' + id));
  }
  rejected(e.verify({}), /workflow stage/);
});

test('real execute records a dirty-source failure without starting a command or replacing prior failure', async (t) => {
  const f = await fixture(t);
  const output = path.join(f.directory, 'never-launched');
  f.owner.initializeFollowup(output, 'scroll', f.candidate);
  writeFileSync(path.join(f.root, 'untracked-drift.txt'), 'dirty');
  const ledger = await f.owner.executeFollowup(output, 'scroll', f.candidate);
  assert.equal(ledger.producerStatus, 'failed');
  assert.match(ledger.producerErrors.join('\n'), /not clean|drifted/);
  assert.equal(ledger.artifacts, undefined);
  await assert.rejects(
    () => f.owner.executeFollowup(output, 'scroll', f.candidate),
    /already started/
  );
});

test('fresh output ownership rejects source paths, aliases and reuse of an earlier producer receipt', async (t) => {
  const f = await fixture(t);
  assert.throws(
    () => f.owner.initializeFollowup(path.join(f.root, 'evidence'), 'drawer', f.candidate),
    /outside/
  );
  assert.throws(
    () => f.owner.initializeFollowup(f.directory, 'drawer', f.candidate),
    /contain the source/
  );
  const target = path.join(f.directory, 'owned-output');
  mkdirSync(target);
  const alias = path.join(f.directory, 'output-alias');
  symlinkSync(target, alias);
  assert.throws(() => f.owner.initializeFollowup(alias, 'drawer', f.candidate), /symbolic-link/);
  const e = f.evidence();
  assert.throws(
    () => f.owner.initializeFollowup(e.output, e.id, f.candidate),
    /earlier follow-up receipt/
  );
});

test('real CLI finalization preserves original failure and an append-only verification history', async (t) => {
  const f = await fixture(t);
  const e = f.evidence();
  const executionFile = path.join(e.raw, 'execution.json');
  const execution = read(executionFile);
  execution.result.exitCode = 23;
  json(executionFile, execution);
  e.seal();
  const original = readFileSync(path.join(e.output, 'results.json'));
  const env = {
    ...process.env,
    GITHUB_ACTIONS: 'false',
    CANDIDATE_SHA: f.candidate,
    SPRINT3_FOLLOWUP_EVIDENCE_DIR: e.output,
  };
  delete env.WORKFLOW_STEP_OUTCOMES;
  const args = [
    path.join(f.root, 'scripts/test/sprint3-followup-evidence.mjs'),
    'finalize',
    '--suite',
    e.id,
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const child = spawnSync(process.execPath, args, {
      cwd: f.root,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, child.stderr);
    assert.equal(child.status, 1, child.stdout + child.stderr);
    assert.equal(read(path.join(e.output, 'verification.json')).status, 'failed');
  }
  assert.deepEqual(readFileSync(path.join(e.output, 'results.json')), original);
  assert.equal(read(executionFile).result.exitCode, 23);
  const history = readFileSync(path.join(e.output, 'verification-history.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(history.length, 2);
  assert.ok(history.every((entry) => entry.status === 'failed'));
});
