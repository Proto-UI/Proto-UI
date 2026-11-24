import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';
import {
  isRetainedClosedPortal,
  isPhysicallyRetiredPortal,
} from './bootstrap-modal-observation.ts';
import {
  BOOTSTRAP_MOTION_SUITES,
  MODAL_CASES,
  PROGRESS_CASES,
  PORTAL_REENTRY_TITLE,
  SPLIT_REJECTION_REASON,
  SPLIT_REJECTION_TITLE,
  assertBootstrapMotionSource,
  inspectBootstrapMotionArtifacts,
  inspectBootstrapMotionReport,
} from './check-bootstrap-motion-evidence.mjs';

const root = path.resolve('/synthetic-bootstrap-checkout');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value));

function reportFixture() {
  return {
    success: true,
    numTotalTests: 142,
    numPassedTests: 142,
    numFailedTests: 0,
    // Vitest's describe/suite count is not its physical test-file count.
    numTotalTestSuites: 29,
    numPassedTestSuites: 29,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: BOOTSTRAP_MOTION_SUITES.map(({ file, cases }) => ({
      name: path.join(root, file),
      status: 'passed',
      assertionResults: Array.from({ length: cases }, (_, index) => ({
        title:
          file.endsWith('progress-width-motion.browser.test.ts') && index === cases - 1
            ? SPLIT_REJECTION_TITLE
            : file.endsWith('portal-conceal.test.ts') && index === cases - 1
              ? PORTAL_REENTRY_TITLE
              : `synthetic case ${index}`,
        fullName: `${file} synthetic case ${index}`,
        status: 'passed',
      })),
    })),
  };
}
const check = (report, stepOutcome = 'success') =>
  inspectBootstrapMotionReport(report, { root, stepOutcome });

test('requires eleven exact files and 142 executed cases while separating positive and rejected profiles', async () => {
  const result = await check(reportFixture());
  assert.equal(result.passed, true, result.failures.join('\n'));
  assert.equal(result.requiredFiles, 11);
  assert.equal(result.requiredAssertions, 142);
  assert.deepEqual(result.hostRegressionCases, { portalAttributeReentry: 1 });
  assert.deepEqual(result.nativePositiveCases, {
    modalDocument: 6,
    progressDocument: 3,
    progressDirectShadow: 3,
  });
  assert.deepEqual(result.negativeAdmissionCases, { progressExperimentalSplit: 1 });
});

for (const [name, mutate] of [
  ['missing required file', (report) => report.testResults.pop()],
  [
    'duplicate file replacing another',
    (report) => {
      report.testResults[1] = structuredClone(report.testResults[0]);
    },
  ],
  [
    'unexpected extra file',
    (report) =>
      report.testResults.push({
        ...report.testResults[0],
        name: path.join(root, 'unexpected.test.ts'),
      }),
  ],
  [
    'empty selected file',
    (report) => {
      report.testResults[0].assertionResults = [];
    },
  ],
  [
    'only five Modal cases',
    (report) =>
      report.testResults
        .find((file) => file.name.endsWith('modal-presence.browser.test.ts'))
        .assertionResults.pop(),
  ],
  ['missing Progress rejection', (report) => report.testResults.at(-1).assertionResults.pop()],
  [
    'only thirty Portal cases',
    (report) =>
      report.testResults
        .find((file) => file.name.endsWith('portal-conceal.test.ts'))
        .assertionResults.pop(),
  ],
  [
    'green extra case replacing the Portal reentry',
    (report) => {
      report.testResults
        .find((file) => file.name.endsWith('portal-conceal.test.ts'))
        .assertionResults.at(-1).title = 'unrelated green test';
    },
  ],
  [
    'duplicate Portal reentry with distinct generic identities',
    (report) => {
      report.testResults.find((file) =>
        file.name.endsWith('portal-conceal.test.ts')
      ).assertionResults[0].title = PORTAL_REENTRY_TITLE;
    },
  ],
  [
    'duplicate case identity',
    (report) => {
      report.testResults[0].assertionResults[1] = { ...report.testResults[0].assertionResults[0] };
    },
  ],
  [
    'skipped assertion',
    (report) => {
      report.testResults[0].assertionResults[0].status = 'skipped';
    },
  ],
  [
    'todo assertion',
    (report) => {
      report.testResults[0].assertionResults[0].status = 'todo';
    },
  ],
  [
    'pending test total',
    (report) => {
      report.numPendingTests = 1;
    },
  ],
  [
    'pending suite total',
    (report) => {
      report.numPendingTestSuites = 1;
    },
  ],
  [
    'todo total',
    (report) => {
      report.numTodoTests = 1;
    },
  ],
  [
    'false assertion total',
    (report) => {
      report.numTotalTests = 143;
    },
  ],
  [
    'runtime error',
    (report) => {
      report.numRuntimeErrorTestSuites = 1;
    },
  ],
  [
    'green extra case replacing the rejection',
    (report) => {
      report.testResults.at(-1).assertionResults.at(-1).title = 'unrelated green test';
    },
  ],
]) {
  test(`rejects ${name}`, async () => {
    const report = reportFixture();
    mutate(report);
    assert.equal((await check(report)).passed, false);
  });
}

test('a failed or unstarted step cannot reuse an old green JSON report', async () => {
  for (const outcome of ['failure', 'cancelled', 'skipped', undefined])
    assert.equal(
      (await inspectBootstrapMotionReport(reportFixture(), { root, stepOutcome: outcome })).passed,
      false
    );
});

function artifactFixture(directory) {
  // Synthetic file-integrity controls only. These bytes are never claimed as
  // a browser capture; the real browser suites own pixels and motion assertions.
  const image = Buffer.alloc(32);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(image);
  image.writeUInt32BE(1000, 16);
  image.writeUInt32BE(700, 20);
  const bundle = 'synthetic bundle',
    css = 'synthetic stylesheet';
  const source = {
    bundleSha256: digest(bundle),
    cssSha256: digest(css),
    sourceSha256: { 'synthetic.ts': 'a'.repeat(64) },
  };
  const modal = path.join(directory, 'bootstrap-modal-presence');
  const progress = path.join(directory, 'bootstrap-progress-width');
  for (const target of [modal, progress]) {
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, 'consumer.js'), bundle);
    writeFileSync(path.join(target, 'tokens.css'), css);
    writeJson(path.join(target, 'source.json'), source);
  }
  writeJson(path.join(progress, 'shadow-artifact.json'), { fixture: true });
  for (const { family, name, file } of MODAL_CASES) {
    const images = [`${file}-sample.png`, `${file}-terminal.png`].map((name) => {
      writeFileSync(path.join(modal, name), image);
      return {
        file: name,
        sha256: digest(image),
        before: { fixture: true },
        after: { fixture: true },
      };
    });
    writeJson(path.join(modal, `${file}.json`), {
      ...source,
      scope: 'document',
      family,
      name,
      status: 'passed',
      errors: [],
      images,
    });
  }
  for (const { scope, name, file } of PROGRESS_CASES) {
    writeFileSync(path.join(progress, `${file}.png`), image);
    writeJson(path.join(progress, `${file}.json`), { ...source, scope, name, errors: [] });
  }
  writeFileSync(path.join(progress, 'shadow-split-unsupported.png'), image);
  writeJson(path.join(progress, 'shadow-split-unsupported.json'), {
    ...source,
    scope: 'shadow-split',
    disposition: 'unsupported',
    countsAsVisualAcceptance: false,
    errors: [`Error: ${SPLIT_REJECTION_REASON}`],
  });
  return { modal, progress };
}

test('requires native source/terminal images and preserves the unsupported split disposition', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'bootstrap-motion-gate-'));
  try {
    const { modal, progress } = artifactFixture(directory);
    const result = inspectBootstrapMotionArtifacts(directory);
    assert.equal(result.modal.length, 6);
    assert.equal(result.progress.length, 6);
    assert.equal(result.splitNegative.countsAsVisualAcceptance, false);
    const file = path.join(modal, 'dialog-enter-close-terminal.png');
    const original = readFileSync(file);
    rmSync(file);
    assert.throws(() => inspectBootstrapMotionArtifacts(directory), /ENOENT/);
    writeFileSync(file, original);
    const caseFile = path.join(progress, 'document-ease-and-reversal.json');
    const record = JSON.parse(readFileSync(caseFile, 'utf8'));
    writeJson(caseFile, { ...record, screenshotError: 'capture failed after a green assertion' });
    assert.throws(() => inspectBootstrapMotionArtifacts(directory), /screenshotError/);
    writeJson(caseFile, record);
    writeFileSync(path.join(progress, 'consumer.js'), 'changed artifact');
    assert.throws(() => inspectBootstrapMotionArtifacts(directory), /digest mismatch/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('source binding rejects dirty, wrong-head and changed inputs', () => {
  const before = {
    expectedSha: 'a'.repeat(40),
    checkoutSha: 'a'.repeat(40),
    dirty: false,
    inputs: { fixture: 'b'.repeat(64) },
  };
  assert.doesNotThrow(() => assertBootstrapMotionSource(before, structuredClone(before)));
  assert.throws(
    () => assertBootstrapMotionSource({ ...before, dirty: true }, before),
    /Dirty checkout/
  );
  assert.throws(
    () => assertBootstrapMotionSource({ ...before, checkoutSha: 'c'.repeat(40) }, before),
    /requested head/
  );
  assert.throws(() => assertBootstrapMotionSource(before, { ...before, inputs: {} }), /changed/);
});

test('rejects nested Modal history/disposal and Progress final capture failures', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'bootstrap-motion-gate-'));
  try {
    const { modal, progress } = artifactFixture(directory);
    for (const [target, file, container, key] of [
      [modal, 'dialog-enter-close', 'history', 'captureError'],
      [modal, 'dialog-enter-close', 'disposal', 'disposeError'],
      [progress, 'document-ease-and-reversal', 'final', 'captureError'],
      [progress, 'shadow-split-unsupported', 'final', 'captureError'],
    ]) {
      const location = path.join(target, `${file}.json`);
      const original = JSON.parse(readFileSync(location, 'utf8'));
      writeJson(location, { ...original, [container]: { [key]: 'late evidence failure' } });
      assert.throws(() => inspectBootstrapMotionArtifacts(directory), /Case recorded/);
      writeJson(location, original);
    }
    assert.doesNotThrow(() => inspectBootstrapMotionArtifacts(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('binds the rejected split case to the same Progress bundle and stylesheet', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'bootstrap-motion-gate-'));
  try {
    const { progress } = artifactFixture(directory);
    const file = path.join(progress, 'shadow-split-unsupported.json');
    const original = JSON.parse(readFileSync(file, 'utf8'));
    for (const field of ['bundleSha256', 'cssSha256']) {
      writeJson(file, { ...original, [field]: 'f'.repeat(64) });
      assert.throws(() => inspectBootstrapMotionArtifacts(directory));
    }
    writeJson(file, original);
    assert.doesNotThrow(() => inspectBootstrapMotionArtifacts(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the dedicated workflow selects every required file and always gates and uploads evidence', () => {
  const workflow = parse(
    readFileSync(
      new URL('../../.github/workflows/bootstrap-state-controls-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const steps = workflow.jobs['browser-evidence'].steps;
  const source = steps.find((step) => step.id === 'bootstrap-motion-source');
  const run = steps.find((step) => step.id === 'bootstrap-motion');
  const gate = steps.find((step) => step.id === 'bootstrap-motion-gate');
  const upload = steps.find(
    (step) =>
      step.uses === 'actions/upload-artifact@v4' && step.with.name.startsWith('bootstrap-motion-')
  );
  assert.ok(source && run && gate && upload);
  assert.ok(steps.indexOf(source) < steps.indexOf(run));
  assert.ok(steps.indexOf(run) < steps.indexOf(gate));
  assert.ok(steps.indexOf(gate) < steps.indexOf(upload));
  const selected = [...run.run.matchAll(/packages\/[^\s\\]+\.test\.ts/g)].map((match) => match[0]);
  assert.deepEqual(selected.sort(), BOOTSTRAP_MOTION_SUITES.map((suite) => suite.file).sort());
  assert.match(run.run, /--pool=forks --maxWorkers=1 --minWorkers=1 --no-file-parallelism/);
  assert.match(run.run, /--reporter=json/);
  assert.match(run.run, /--outputFile="\$PUI_FINF_FEATURE_EVIDENCE_DIR\/vitest\.json"/);
  assert.equal(Object.hasOwn(run, 'continue-on-error'), false);
  assert.equal(gate.if, 'always()');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.match(gate.env.EVIDENCE_STEP_STATUS, /steps\.bootstrap-motion\.outcome/);
  assert.equal(source.env.PUI_FINF_FEATURE_EVIDENCE_DIR, run.env.PUI_FINF_FEATURE_EVIDENCE_DIR);
  assert.equal(run.env.PUI_FINF_FEATURE_EVIDENCE_DIR, gate.env.PUI_FINF_FEATURE_EVIDENCE_DIR);
  assert.equal(gate.env.PUI_FINF_FEATURE_EVIDENCE_DIR, upload.with.path);
});

// Synthetic controls execute the actual workflow finalizer. They are not
// evidence that the CLI, type checker, graph or packed consumers have run.
function sourceValidationFixture() {
  const workflow = parse(
    readFileSync(
      new URL('../../.github/workflows/bootstrap-state-controls-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const job = workflow.jobs['source-validation'];
  const finalizer = job.steps.find((step) => step.id === 'source_results').run;
  const script = finalizer.match(/<<'NODE'[^\n]*\n([\s\S]*?)\nNODE(?:\n|$)/)?.[1];
  assert.ok(script, 'Missing actual source-validation finalizer');
  const sha = 'a'.repeat(40),
    tree = 'b'.repeat(40);
  const stageIds = [
    'source_before',
    'install',
    'cli_build',
    'website_generate',
    'type_contracts',
    'workspace_types',
    'spec_graph',
    'draft_consumer',
  ];
  const outcomes = Object.fromEntries(
    ['checkout', 'node_setup', ...stageIds].map((id) => [id, 'success'])
  );
  const files = new Map([
    ['source-head-before.txt', sha + '\n'],
    ['source-tree-before.txt', tree + '\n'],
    ['source-status-before.txt', ''],
  ]);
  for (const id of stageIds) {
    const name = id.replaceAll('_', '-');
    files.set(name + '.exit', '0\n');
    files.set(name + '.log-exit', '0\n');
    files.set(name + '.log', '');
  }
  const graphPaths = [
    'packages/spec/graph/test/synthetic.test.ts',
    'packages/spec/fixtures/test/prototype-inheritance-schema.test.ts',
    'packages/spec/fixtures/test/adapter-profile-schema.test.ts',
    'packages/spec/fixtures/test/feedback-style-authoring.test.ts',
    'packages/spec/fixtures/test/feedback-style-runtime-patch.test.ts',
  ];
  const report = {
    success: true,
    numTotalTests: 40,
    numPassedTests: 40,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    testResults: graphPaths.map((file) => ({
      name: path.join(root, file),
      status: 'passed',
      assertionResults: Array.from({ length: 8 }, (_, index) => ({
        fullName: file + ' synthetic case ' + index,
        status: 'passed',
      })),
    })),
  };
  files.set('spec-graph.json', JSON.stringify(report));
  files.set(
    'draft-consumer.log',
    [
      'TAP version 13',
      ...Array.from(
        { length: 6 },
        (_, index) => 'ok ' + (index + 1) + ' - synthetic consumer ' + index
      ),
      '1..6',
      '# tests 6',
      '# pass 6',
      '# fail 0',
      '# cancelled 0',
      '# skipped 0',
      '# todo 0',
      '# duration_ms 1',
      '',
    ].join('\n')
  );
  return { job, script, sha, tree, outcomes, files, afterHead: sha, afterStatus: '' };
}
function runSourceValidationFixture(fixture) {
  const writes = new Map();
  const mockProcess = {
    env: {
      EVIDENCE_DIR: '/synthetic-evidence',
      PROTO_UI_EXPECTED_HEAD_SHA: fixture.sha,
      GITHUB_SHA: fixture.sha,
      GITHUB_RUN_ID: 'synthetic-run',
      GITHUB_RUN_ATTEMPT: '1',
      SOURCE_STEP_OUTCOMES: JSON.stringify(fixture.outcomes),
    },
    version: 'v24.22.3',
    cwd: () => root,
    exitCode: undefined,
  };
  const mockRequire = (name) => {
    if (name === 'node:assert/strict') return assert;
    if (name === 'node:path') return path;
    if (name === 'node:fs')
      return {
        mkdirSync() {},
        readFileSync(file) {
          const key = path.basename(file);
          if (!fixture.files.has(key)) throw new Error('Missing synthetic file: ' + key);
          return fixture.files.get(key);
        },
        writeFileSync(file, value) {
          writes.set(path.basename(file), value);
        },
      };
    if (name === 'node:child_process')
      return {
        execFileSync(command, args) {
          assert.equal(command, 'git');
          if (args[0] === 'rev-parse')
            return (args[1] === 'HEAD' ? fixture.afterHead : fixture.tree) + '\n';
          if (args[0] === 'status') return fixture.afterStatus;
          if (args[0] === 'ls-files') return 'packages/spec/graph/test/synthetic.test.ts\0';
          throw new Error('Unexpected synthetic git command: ' + args.join(' '));
        },
      };
    throw new Error('Unexpected finalizer dependency: ' + name);
  };
  runInNewContext(
    fixture.script,
    {
      require: mockRequire,
      process: mockProcess,
      console: { log() {} },
    },
    { timeout: 1000 }
  );
  assert.ok(writes.has('manifest.json'), 'A terminal manifest must survive failure');
  assert.ok(writes.has('source-after.json'), 'The final source observation must survive failure');
  return { receipt: JSON.parse(writes.get('manifest.json')), exitCode: mockProcess.exitCode ?? 0 };
}

test('source validation uses real prerequisites, step-scoped evidence initialization and a terminal gate', () => {
  const { job } = sourceValidationFixture();
  assert.equal(job['timeout-minutes'], 20);
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.equal(job.env.EVIDENCE_DIR, undefined);
  assert.match(job.steps[0].run, /\$RUNNER_TEMP\/bootstrap-source-validation-/);
  assert.match(job.steps[0].run, />> "\$GITHUB_ENV"/);
  assert.equal(
    job.steps.find((step) => step.id === 'checkout').with.ref,
    job.env.PROTO_UI_EXPECTED_HEAD_SHA
  );
  assert.match(
    job.steps.find((step) => step.id === 'workspace_types').if,
    /website_generate\.outcome == 'success'/
  );
  assert.match(
    job.steps.find((step) => step.id === 'draft_consumer').if,
    /cli_build\.outcome == 'success'/
  );
  assert.match(job.steps.find((step) => step.id === 'source_results').if, /always\(\)/);
  assert.match(job.steps.at(-1).if, /always\(\)/);
});

test('source finalizer accepts complete source, graph and consumer execution receipts', () => {
  const result = runSourceValidationFixture(sourceValidationFixture());
  assert.equal(result.exitCode, 0, JSON.stringify(result.receipt.failures));
  assert.equal(result.receipt.status, 'passed');
  assert.equal(result.receipt.specGraph.assertions, 40);
  assert.equal(result.receipt.draftConsumer.tests, 6);
});

for (const [name, mutate] of [
  [
    'skipped command despite green reports',
    (f) => {
      f.outcomes.workspace_types = 'skipped';
    },
  ],
  [
    'failed command despite green reports',
    (f) => {
      f.files.set('draft-consumer.exit', '1\n');
    },
  ],
  [
    'failed log capture despite green reports',
    (f) => {
      f.files.set('spec-graph.log-exit', '1\n');
    },
  ],
  [
    'missing graph report',
    (f) => {
      f.files.delete('spec-graph.json');
    },
  ],
  [
    'skipped graph assertion despite a green total',
    (f) => {
      const report = JSON.parse(f.files.get('spec-graph.json'));
      report.testResults[0].assertionResults[0].status = 'pending';
      f.files.set('spec-graph.json', JSON.stringify(report));
    },
  ],
  [
    'inflated consumer TAP footer',
    (f) => {
      f.files.set(
        'draft-consumer.log',
        f.files
          .get('draft-consumer.log')
          .replace(/^ok [2-6] -.*\n/gm, '')
          .replace(/^1\.\.6$/m, '1..1')
      );
    },
  ],
  [
    'incomplete consumer TAP',
    (f) => {
      f.files.set(
        'draft-consumer.log',
        f.files.get('draft-consumer.log').replace('# duration_ms 1\n', '')
      );
    },
  ],
  [
    'dirty final source',
    (f) => {
      f.afterStatus = ' M packages/core/src/index.ts\n';
    },
  ],
  [
    'changed final head',
    (f) => {
      f.afterHead = 'c'.repeat(40);
    },
  ],
]) {
  test('source finalizer rejects ' + name + ' and retains failed evidence', () => {
    const fixture = sourceValidationFixture();
    mutate(fixture);
    const result = runSourceValidationFixture(fixture);
    assert.equal(result.exitCode, 1);
    assert.equal(result.receipt.status, 'failed');
    assert.ok(result.receipt.failures.length > 0);
  });
}
test('Modal observation waits for physical withdrawal and acknowledged unmount', () => {
  // Captured-fact controls only, using the predicates called inside page.evaluate.
  const entered = {
    phase: 'entered',
    present: true,
    connected: true,
    portaled: true,
    detached: false,
    owner: 7,
    viewEpoch: 3,
    created: 1,
    mounted: 3,
    unmounted: 2,
    concealed: false,
    inert: false,
  };
  const barrier = {
    ...entered,
    phase: 'closed',
    present: false,
    detached: true,
    concealed: true,
    inert: true,
  };
  assert.equal(isRetainedClosedPortal(barrier, entered), true);
  assert.equal(isPhysicallyRetiredPortal(barrier, entered), false);
  for (const premature of [
    { ...barrier, portaled: false },
    { ...barrier, unmounted: 3 },
  ]) {
    assert.equal(isRetainedClosedPortal(premature, entered), false);
    assert.equal(isPhysicallyRetiredPortal(premature, entered), false);
  }
  const retired = { ...barrier, portaled: false, unmounted: 3 };
  assert.equal(isRetainedClosedPortal(retired, entered), false);
  assert.equal(isPhysicallyRetiredPortal(retired, entered), true);
});

test('Modal observation rejects replaced lifetimes and missing conceal ownership', () => {
  const entered = {
    phase: 'entered',
    present: true,
    connected: true,
    portaled: true,
    detached: false,
    owner: 7,
    viewEpoch: 3,
    created: 1,
    mounted: 3,
    unmounted: 2,
    concealed: false,
    inert: false,
  };
  const barrier = {
    ...entered,
    phase: 'closed',
    present: false,
    detached: true,
    concealed: true,
    inert: true,
  };
  for (const changes of [
    { owner: 8 },
    { viewEpoch: 4 },
    { created: 2 },
    { mounted: 4, unmounted: 3 },
    { unmounted: 3 },
    { connected: false },
    { detached: false },
    { present: true },
    { concealed: false },
    { inert: false },
    { phase: 'leaving' },
  ])
    assert.equal(isRetainedClosedPortal({ ...barrier, ...changes }, entered), false);
  const retired = { ...barrier, portaled: false, unmounted: 3 };
  for (const changes of [
    { owner: 8 },
    { viewEpoch: 4 },
    { created: 2 },
    { mounted: 4, unmounted: 4 },
    { unmounted: 2 },
    { connected: false },
    { detached: false },
    { present: true },
    { concealed: false },
  ])
    assert.equal(
      isPhysicallyRetiredPortal({ ...retired, ...changes }, entered),
      false,
      JSON.stringify(changes)
    );
});
