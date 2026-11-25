import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir as osTmpdir } from 'node:os';

const tmpdir = () => realpathSync(osTmpdir());
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  SPRINT3_SUITES,
  finalize,
  parseEvidenceProfile,
  profileBinding,
  profileProblems,
  sealProductionArtifact,
  sprint3Profile,
} from './sprint3-consumer-evidence.mjs';

// These are synthetic producer receipts for real finalizer/CLI contract tests.
// They do not run Chromium, build documentation, or claim any native acceptance.
const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const cases = ['en', 'zh-cn'].flatMap((locale) =>
  ['wc', 'react', 'vue', 'vue2'].map((runtime) => ({
    stem: `base-select-${locale}-${runtime}`,
    route: `/${locale}/ui-libraries/base/select/`,
    runtime,
  }))
);
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value) + '\n');

test('default stays 14/364 and Base Select is an explicit independent 1/8 profile', () => {
  assert.equal(sprint3Profile().id, 'default');
  assert.equal(sprint3Profile().suites, SPRINT3_SUITES);
  assert.equal(SPRINT3_SUITES.length, 14);
  assert.equal(
    SPRINT3_SUITES.reduce((sum, row) => sum + row.cases, 0),
    364
  );
  assert.equal(profileBinding('default').files, 14);
  assert.equal(profileBinding('default').cases, 364);
  const selected = sprint3Profile('base-select');
  assert.equal(selected.suites.length, 1);
  assert.equal(
    selected.suites[0].file,
    'apps/www/src/content/docs/zh-cn/demo-base-select.browser.test.ts'
  );
  assert.equal(selected.suites[0].cases, 8);
  assert.equal(selected.suites[0].surface, 'production-docs');
  assert.equal(selected.suites[0].screenshots, true);
  assert.equal(profileBinding('base-select').files, 1);
  assert.equal(profileBinding('base-select').cases, 8);
  assert.notEqual(
    profileBinding('base-select').inventorySha256,
    profileBinding('default').inventorySha256
  );
  assert.equal(parseEvidenceProfile([]).id, 'default');
  assert.equal(parseEvidenceProfile(['--profile', 'base-select']).id, 'base-select');
  for (const args of [
    ['--profile'],
    ['--profile', 'unknown'],
    ['--profile', '__proto__'],
    ['--profile', 'base-select', '--testNamePattern', 'Vue'],
    ['--profile', 'base-select', '--profile', 'default'],
  ])
    assert.throws(() => parseEvidenceProfile(args));
});

function fixture(t) {
  const output = mkdtempSync(path.join(tmpdir(), 'sprint3-select-profile-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  const planned = sprint3Profile('base-select').suites[0];
  const directory = path.join(output, planned.id);
  const captures = path.join(directory, 'captures');
  mkdirSync(captures, { recursive: true });
  const source = {
    head: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    worktreeStatus: '',
    lockSha256: 'c'.repeat(64),
    runnerSha256: 'd'.repeat(64),
    sourceServerSha256: 'e'.repeat(64),
  };
  const preview = {
    owner: 'synthetic finalizer fixture, not a running browser or preview',
    url: 'http://127.0.0.1:32000',
    head: source.head,
    probePath: sprint3Profile('base-select').probePath,
    probeSha256: 'f'.repeat(64),
    distManifestSha256: '0'.repeat(64),
  };
  const row = {
    ...planned,
    status: 'passed',
    sourceSha256: '1'.repeat(64),
    process: { exitCode: 0, signal: null, stopReason: null, spawnError: null, ioError: null },
  };
  const ledger = {
    schemaVersion: 1,
    profile: profileBinding('base-select'),
    expectedHead: source.head,
    source,
    preview,
    errors: [],
    limits: ['Synthetic finalizer fixture; no native acceptance.'],
    build: { status: 'passed', distManifestSha256: preview.distManifestSha256 },
    suites: [row],
  };
  const report = {
    success: true,
    numTotalTests: 8,
    numPassedTests: 8,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        name: '/synthetic-checkout/' + planned.file,
        assertionResults: cases.map(({ stem }) => ({ fullName: stem, status: 'passed' })),
      },
    ],
  };
  writeJson(path.join(directory, 'vitest.json'), report);
  writeFileSync(path.join(directory, 'browser.log'), 'synthetic successful process log\n');
  writeJson(path.join(directory, 'source.json'), {
    ...source,
    profile: ledger.profile,
    suite: row.file,
    suiteSha256: row.sourceSha256,
    surface: row.surface,
    preview,
    sourceCanary: null,
  });
  row.reportSha256 = sha(readFileSync(path.join(directory, 'vitest.json')));
  row.logSha256 = sha(readFileSync(path.join(directory, 'browser.log')));
  row.sourceReceiptSha256 = sha(readFileSync(path.join(directory, 'source.json')));
  for (const { stem, route, runtime } of cases) {
    writeJson(path.join(captures, stem + '.json'), {
      testSource: source.head,
      servedPageRevision: null,
      browser: 'synthetic Chromium fixture',
      route,
      runtime,
      outcome: 'PASS',
      failure: null,
      errors: [],
      observations: [],
    });
    writeFileSync(
      path.join(captures, stem + '.png'),
      'synthetic integrity bytes; not a browser image\n'
    );
  }
  const captureInventory = () =>
    readdirSync(captures)
      .sort()
      .map((file) => {
        const bytes = readFileSync(path.join(captures, file));
        return { file, bytes: bytes.length, sha256: sha(bytes) };
      });
  row.artifacts = captureInventory();
  for (const [name, bytes] of [
    ['build.log', 'synthetic completed production build\n'],
    ['dist-files.json', '[{"file":"en/index.html","bytes":8,"sha256":"fixture"}]\n'],
    ['preview-requests.jsonl', '{"method":"GET","url":"/en/","status":200}\n'],
  ]) {
    writeFileSync(path.join(output, name), bytes);
    sealProductionArtifact(output, ledger, name);
  }
  const run = (profile = 'base-select') => finalize(output, ledger, false, () => source, profile);
  const stored = () => JSON.parse(readFileSync(path.join(output, 'results.json'), 'utf8'));
  const replaceReport = (value) => {
    writeJson(path.join(directory, 'vitest.json'), value);
    row.reportSha256 = sha(readFileSync(path.join(directory, 'vitest.json')));
  };
  return {
    output,
    directory,
    captures,
    source,
    row,
    ledger,
    report,
    run,
    stored,
    captureInventory,
    replaceReport,
  };
}

test('the real finalizer accepts a complete bound Select fixture and preserves its scope', (t) => {
  const f = fixture(t);
  assert.deepEqual(profileProblems(f.ledger, 'base-select'), []);
  assert.equal(f.run(), 0);
  const saved = f.stored();
  assert.equal(saved.status, 'passed');
  assert.equal(saved.profile.id, 'base-select');
  assert.equal(saved.profile.cases, 8);
  assert.equal(saved.suites.length, 1);
  assert.equal(saved.suites[0].screenshotCount, 8);
  assert.equal(saved.finalization.status, 'complete');
});

test('Select receipts cannot finalize under default or an unknown profile', (t) => {
  for (const profile of ['default', 'unknown']) {
    const f = fixture(t);
    assert.equal(f.run(profile), 1);
    assert.equal(f.stored().status, 'failed');
    assert.ok(f.stored().profileProblems.length);
    assert.equal(f.stored().finalization.status, 'complete');
  }
});

test('a default 364 receipt cannot be relabelled as the one-file Select inventory', (t) => {
  const f = fixture(t);
  f.ledger.profile = profileBinding('default');
  f.ledger.suites = SPRINT3_SUITES.map((row) => ({ ...row, status: 'not-run' }));
  assert.equal(f.run(), 1);
  const saved = f.stored();
  assert.equal(saved.status, 'failed');
  assert.equal(saved.profile.cases, 364, 'retain the mismatched source receipt for diagnosis');
  assert.ok(saved.suites.every((row) => row.status === 'blocked'));
  assert.match(saved.profileProblems.join('\n'), /binding differs|missing or extra/);
});

test('missing, added, downgraded or altered plan facts cannot retain a green profile', (t) => {
  const mutations = [
    (ledger) => {
      delete ledger.profile;
    },
    (ledger) => {
      ledger.profile.id = 'default';
    },
    (ledger) => {
      ledger.profile.inventorySha256 = '0'.repeat(64);
    },
    (ledger) => {
      ledger.profile.cases = 7;
    },
    (ledger) => {
      ledger.suites = [];
    },
    (ledger) => {
      ledger.suites.push({ ...ledger.suites[0] });
    },
    (ledger) => {
      ledger.suites[0].file = 'apps/www/another.browser.test.ts';
    },
    (ledger) => {
      ledger.suites[0].id = '../unowned';
    },
    (ledger) => {
      ledger.suites[0].cases = 7;
    },
    (ledger) => {
      ledger.suites[0].surface = 'fixture';
    },
    (ledger) => {
      ledger.suites[0].screenshots = false;
    },
    (ledger) => {
      ledger.suites[0].seconds += 1;
    },
  ];
  for (const mutate of mutations) {
    const f = fixture(t);
    mutate(f.ledger);
    assert.equal(f.run(), 1);
    const saved = f.stored();
    assert.equal(saved.status, 'failed');
    assert.ok(saved.profileProblems.length);
    assert.equal(saved.finalization.status, 'complete');
  }
});

test('profile finalization rechecks all eight Vitest cases and the exact source file', (t) => {
  for (const mutate of [
    (report) => {
      report.numTotalTests = 7;
      report.numPassedTests = 7;
      report.testResults[0].assertionResults.pop();
    },
    (report) => {
      report.numPassedTests = 7;
      report.numPendingTests = 1;
      report.testResults[0].assertionResults[0].status = 'skipped';
    },
    (report) => {
      report.testResults[0].name = '/synthetic-checkout/old-tooltip.browser.test.ts';
    },
  ]) {
    const f = fixture(t);
    mutate(f.report);
    // Bind the changed producer bytes: this exercises semantic reconciliation,
    // separately from the existing changed-bytes integrity negative controls.
    f.replaceReport(f.report);
    assert.equal(f.run(), 1);
    assert.equal(f.stored().status, 'failed');
    assert.match(
      f.stored().suites[0].evidenceProblems.join('\n'),
      /expected 8|complete case inventory|different source file/
    );
  }
});

test('eight route and runtime case captures must bind the same candidate and succeed', (t) => {
  for (const mutate of [
    (receipt) => {
      receipt.testSource = '9'.repeat(40);
    },
    (receipt) => {
      receipt.runtime = 'vue2';
    },
    (receipt) => {
      receipt.route = '/zh-cn/ui-libraries/base/tooltip/';
    },
    (receipt) => {
      receipt.outcome = 'FAIL';
      receipt.failure = 'native assertion failed';
    },
    (receipt) => {
      receipt.errors = ['pageerror'];
    },
  ]) {
    const f = fixture(t);
    const file = path.join(f.captures, cases[0].stem + '.json');
    const receipt = JSON.parse(readFileSync(file, 'utf8'));
    mutate(receipt);
    writeJson(file, receipt);
    f.row.artifacts = f.captureInventory();
    assert.equal(f.run(), 1);
    assert.match(
      f.stored().suites[0].evidenceProblems.join('\n'),
      /case binding or outcome differs/
    );
  }
  for (const extension of ['json', 'png']) {
    const f = fixture(t);
    rmSync(path.join(f.captures, cases[0].stem + '.' + extension));
    f.row.artifacts = f.captureInventory();
    assert.equal(f.run(), 1);
    assert.match(
      f.stored().suites[0].evidenceProblems.join('\n'),
      /exactly eight JSON and eight PNG|case unavailable|screenshot missing/
    );
  }
});

test('profile source receipts and owned preview cannot be rebound after execution', (t) => {
  for (const mutation of ['profile', 'candidate', 'preview']) {
    const f = fixture(t);
    const file = path.join(f.directory, 'source.json');
    const receipt = JSON.parse(readFileSync(file, 'utf8'));
    if (mutation === 'profile') receipt.profile = profileBinding('default');
    if (mutation === 'candidate') receipt.head = '9'.repeat(40);
    if (mutation === 'preview') {
      f.ledger.preview.probePath = '/en/ui-libraries/base/button/';
      receipt.preview = f.ledger.preview;
    }
    writeJson(file, receipt);
    f.row.sourceReceiptSha256 = sha(readFileSync(file));
    assert.equal(f.run(), 1);
    assert.match(
      f.stored().suites[0].evidenceProblems.join('\n'),
      /source receipt does not bind|preview does not bind/
    );
  }
});

test('the Select profile still requires sealed production artifacts and terminal outcomes', (t) => {
  const f = fixture(t);
  const original = structuredClone(f.ledger.productionArtifacts);
  assert.equal(f.run(), 0);
  writeFileSync(path.join(f.output, 'preview-requests.jsonl'), 'changed after producer closed\n');
  assert.equal(f.run(), 1);
  assert.deepEqual(f.stored().productionArtifacts, original);
  assert.match(f.stored().productionEvidenceProblems.join('\n'), /hash or length drifted/);
  for (const status of ['not-run', 'running', 'failed']) {
    const unrun = fixture(t);
    unrun.row.status = status;
    assert.equal(unrun.run(), 1);
    assert.equal(
      unrun.stored().suites[0].status,
      status === 'not-run' ? 'blocked' : status === 'running' ? 'interrupted' : 'failed'
    );
    assert.equal(unrun.stored().status, 'failed');
  }
});

function cliFixture(t) {
  const outer = mkdtempSync(path.join(tmpdir(), 'sprint3-profile-cli-'));
  t.after(() => rmSync(outer, { recursive: true, force: true }));
  const root = path.join(outer, 'checkout');
  const entry = 'scripts/test/sprint3-consumer-evidence.mjs';
  mkdirSync(path.join(root, 'scripts/test'), { recursive: true });
  for (const file of [entry, 'scripts/test/sprint3-source-server.mjs'])
    writeFileSync(path.join(root, file), readFileSync(path.join(repository, file)));
  writeFileSync(path.join(root, 'pnpm-lock.yaml'), 'synthetic clean-source init fixture\n');
  for (const row of [...SPRINT3_SUITES, ...sprint3Profile('base-select').suites]) {
    mkdirSync(path.dirname(path.join(root, row.file)), { recursive: true });
    writeFileSync(path.join(root, row.file), '// source-hash fixture; never executed\n');
  }
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('add', '.');
  git(
    '-c',
    'user.name=Profile fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'profile init fixture'
  );
  const head = git('rev-parse', 'HEAD');
  const run = (output, operation, profile) =>
    spawnSync(
      process.execPath,
      [path.join(root, entry), operation, ...(profile ? ['--profile', profile] : [])],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          CANDIDATE_SHA: head,
          SPRINT3_EVIDENCE_DIR: output,
          WORKFLOW_STEP_OUTCOMES: '{}',
        },
      }
    );
  return { outer, root, head, run };
}

test('actual CLI init binds separate plans and cross-profile run finalizes before any build', (t) => {
  const f = cliFixture(t);
  for (const [initialized, requested, count] of [
    [undefined, 'base-select', 14],
    ['base-select', 'default', 1],
  ]) {
    const output = path.join(f.outer, 'evidence-' + String(initialized));
    const init = f.run(output, 'init', initialized);
    assert.equal(init.status, 0, init.stderr);
    const initial = JSON.parse(readFileSync(path.join(output, 'results.json'), 'utf8'));
    assert.equal(initial.expectedHead, f.head);
    assert.equal(initial.source.worktreeStatus, '');
    assert.equal(initial.suites.length, count);
    const wrong = f.run(output, 'run', requested);
    assert.equal(wrong.status, 1, wrong.stderr);
    const result = JSON.parse(readFileSync(path.join(output, 'results.json'), 'utf8'));
    assert.equal(result.status, 'failed');
    assert.equal(result.build.status, 'blocked');
    assert.ok(result.profileProblems.length);
    assert.ok(result.suites.every((row) => row.status === 'blocked'));
    assert.equal(result.finalization.status, 'complete');
    assert.ok(!readdirSync(output).includes('build.log'), 'rejected profile never starts a build');
  }
});

test('claimed passed Select cannot omit captures through a failed execution status', (t) => {
  const f = fixture(t);
  f.row.executionStatus = 'failed';
  for (const file of readdirSync(f.captures)) rmSync(path.join(f.captures, file));
  f.row.artifacts = f.captureInventory();
  assert.deepEqual(f.row.artifacts, []);
  assert.equal(f.row.status, 'passed');
  assert.equal(f.run(), 1);
  const saved = f.stored();
  assert.equal(saved.status, 'failed');
  assert.equal(saved.suites[0].status, 'failed');
  assert.match(saved.suites[0].evidenceProblems.join('\n'), /execution status|screenshots/);
  assert.equal(saved.finalization.status, 'complete');
});

test('claimed passed Select still reconciles a failed Vitest result', (t) => {
  const f = fixture(t);
  f.row.executionStatus = 'failed';
  f.report.success = false;
  f.report.numPassedTests = 7;
  f.report.numFailedTests = 1;
  f.report.testResults[0].assertionResults[0].status = 'failed';
  f.replaceReport(f.report);
  assert.equal(f.row.status, 'passed');
  assert.equal(f.run(), 1);
  const saved = f.stored();
  assert.equal(saved.status, 'failed');
  assert.equal(saved.suites[0].status, 'failed');
  assert.match(
    saved.suites[0].evidenceProblems.join('\n'),
    /Vitest did not report success|complete case inventory/
  );
  assert.match(saved.suites[0].evidenceProblems.join('\n'), /execution status/);
});
