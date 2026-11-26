import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOOTSTRAP_MOTION_SUITES = Object.freeze([
  { file: 'packages/core/test/presence-top-declaration.test.ts', cases: 10 },
  { file: 'packages/modules/feedback/test/presence-top-projector.test.ts', cases: 18 },
  { file: 'packages/adapters/base/test/web-presence-top.test.ts', cases: 17 },
  {
    file: 'packages/prototypes/bootstrap-2-3-2/test/modal-presence-presentation.test.ts',
    cases: 18,
  },
  { file: 'packages/adapters/web-component/test/portal-conceal.test.ts', cases: 31 },
  { file: 'packages/modules/feedback/test/resident-width.test.ts', cases: 9 },
  { file: 'packages/adapters/base/test/web-resident-width.test.ts', cases: 14 },
  { file: 'packages/adapters/base/test/web-resident-width-adoption.test.ts', cases: 13 },
  { file: 'packages/runtime/test/contract/resident-width.contract.test.ts', cases: 2 },
  { file: 'packages/prototypes/bootstrap-2-3-2/test/modal-presence.browser.test.ts', cases: 6 },
  {
    file: 'packages/prototypes/bootstrap-2-3-2/test/progress-width-motion.browser.test.ts',
    cases: 7,
  },
]);
export const MODAL_CASES = ['dialog', 'alert-dialog'].flatMap((family) =>
  ['enter-close', 'leaving-reopen', 'barrier-reopen'].map((name) => ({
    family,
    name,
    file: `${family}-${name}`,
  }))
);
export const PROGRESS_CASES = ['document', 'direct-shadow'].flatMap((scope) =>
  ['ease-and-reversal', 'reduced-and-indeterminate', 'important-owner'].map((name) => ({
    scope,
    name,
    file: `${scope}-${name}`,
  }))
);
export const PORTAL_REENTRY_TITLE =
  'retains the reopened event gate after native detached attribute reentry';
export const SPLIT_REJECTION_TITLE =
  'rejects unresolved Track clipping atomically without claiming split visual support';
export const SPLIT_REJECTION_REASON =
  '[bootstrap-2-3-2-progress-track]setup token "overflow-hidden":unresolved-role; fix: companion or change/remove token';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const message = (error) => (error instanceof Error ? error.message : String(error));
const totalCases = BOOTSTRAP_MOTION_SUITES.reduce((sum, suite) => sum + suite.cases, 0);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value, options) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, options);

// A thin strict selection around the repository's shared execution checker.
// Import it lazily so setup failures can still leave a terminal receipt.
export async function inspectBootstrapMotionReport(
  report,
  { root = repositoryRoot, stepOutcome } = {}
) {
  const failures = [];
  const check = (run) => {
    try {
      run();
    } catch (error) {
      failures.push(message(error));
    }
  };
  check(() => assert.equal(stepOutcome, 'success', 'Motion execution step did not succeed'));
  check(() => assert.equal(new Set(BOOTSTRAP_MOTION_SUITES.map((suite) => suite.file)).size, 11));
  try {
    const { assertVitestReport } = await import('./runtime-ci.mjs');
    assertVitestReport(
      report,
      {
        phase: 'browser', // This shared branch requires every assertion to pass.
        suites: BOOTSTRAP_MOTION_SUITES.map((suite) => suite.file),
      },
      root
    );
  } catch (error) {
    failures.push(message(error));
  }
  for (const key of ['numPendingTests', 'numTodoTests', 'numPendingTestSuites'])
    check(() => assert.equal(report?.[key], 0, `${key} must be zero`));
  if (report?.numRuntimeErrorTestSuites !== undefined)
    check(() => assert.equal(report.numRuntimeErrorTestSuites, 0, 'Runtime errors'));
  const files = Array.isArray(report?.testResults) ? report.testResults : [];
  const actual = files.flatMap((file) =>
    Array.isArray(file.assertionResults) ? file.assertionResults : []
  );
  check(() => assert.equal(report?.numTotalTests, totalCases, 'Required total assertion count'));
  check(() => assert.equal(actual.length, totalCases, 'Actual assertion inventory'));
  const suites = BOOTSTRAP_MOTION_SUITES.map((required) => {
    const matches = files.filter(
      (file) =>
        typeof file.name === 'string' &&
        path.relative(root, file.name).replaceAll('\\', '/') === required.file
    );
    check(() => assert.equal(matches.length, 1, `Missing or duplicate file: ${required.file}`));
    const assertions = matches.flatMap((file) => file.assertionResults ?? []);
    check(() => assert.equal(assertions.length, required.cases, `Case count: ${required.file}`));
    check(() =>
      assert.ok(
        assertions.every((test) => typeof test.fullName === 'string' && test.fullName.trim()),
        `Missing case identity: ${required.file}`
      )
    );
    check(() =>
      assert.equal(
        new Set(assertions.map((test) => test.fullName)).size,
        assertions.length,
        `Duplicate case identity: ${required.file}`
      )
    );
    return { ...required, occurrences: matches.length, actualCases: assertions.length };
  });
  const portal = files.filter(
    (file) =>
      typeof file.name === 'string' &&
      path.relative(root, file.name).replaceAll('\\', '/') ===
        'packages/adapters/web-component/test/portal-conceal.test.ts'
  );
  check(() =>
    assert.equal(
      portal
        .flatMap((file) => file.assertionResults ?? [])
        .filter((test) => test.title === PORTAL_REENTRY_TITLE && test.status === 'passed').length,
      1,
      'The Happy-DOM native-attribute reentry control must execute exactly once'
    )
  );
  const progress = files.filter(
    (file) =>
      typeof file.name === 'string' &&
      path.relative(root, file.name).replaceAll('\\', '/') === BOOTSTRAP_MOTION_SUITES.at(-1).file
  );
  check(() =>
    assert.equal(
      progress
        .flatMap((file) => file.assertionResults ?? [])
        .filter((test) => test.title === SPLIT_REJECTION_TITLE && test.status === 'passed').length,
      1,
      'The experimental split rejection must execute exactly once'
    )
  );
  return {
    passed: failures.length === 0,
    failures,
    suites,
    requiredFiles: 11,
    requiredAssertions: totalCases,
    hostRegressionCases: { portalAttributeReentry: 1 },
    nativePositiveCases: { modalDocument: 6, progressDocument: 3, progressDirectShadow: 3 },
    negativeAdmissionCases: { progressExperimentalSplit: 1 },
  };
}

function nonempty(file) {
  const content = readFileSync(file);
  assert.ok(content.length > 0, `Empty evidence file: ${file}`);
  return content;
}
function png(directory, name) {
  assert.ok(
    name && !path.isAbsolute(name) && path.basename(name) === name,
    'PNG must use a relative filename'
  );
  const content = nonempty(path.join(directory, name));
  assert.equal(content.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Invalid PNG: ${name}`);
  assert.ok(content.length >= 24, `Truncated PNG: ${name}`);
  assert.equal(content.readUInt32BE(16), 1000, `PNG viewport width: ${name}`);
  assert.equal(content.readUInt32BE(20), 700, `PNG viewport height: ${name}`);
  return { file: name, sha256: sha256(content), bytes: content.length };
}
function sourceFiles(directory, requireInputHashes) {
  assert.equal(
    existsSync(path.join(directory, 'setup-error.json')),
    false,
    'Browser setup error was recorded'
  );
  const source = JSON.parse(nonempty(path.join(directory, 'source.json')).toString('utf8'));
  const bundle = nonempty(path.join(directory, 'consumer.js'));
  const css = nonempty(path.join(directory, 'tokens.css'));
  assert.equal(source.bundleSha256, sha256(bundle), 'Browser bundle digest mismatch');
  assert.equal(source.cssSha256, sha256(css), 'Browser stylesheet digest mismatch');
  if (requireInputHashes) {
    assert.ok(
      Object.keys(source.sourceSha256 ?? {}).length > 0,
      'Missing browser source input hashes'
    );
    for (const hash of Object.values(source.sourceSha256)) assert.match(hash, /^[a-f0-9]{64}$/);
  }
  return { bundleSha256: source.bundleSha256, cssSha256: source.cssSha256 };
}
function assertNoCaptureErrors(record) {
  for (const key of ['failure', 'screenshotError', 'captureError', 'disposeError'])
    assert.equal(Object.hasOwn(record, key), false, `Case recorded ${key}`);
  for (const [container, key] of [
    ['history', 'captureError'],
    ['disposal', 'disposeError'],
    ['final', 'captureError'],
  ])
    assert.equal(
      Object.hasOwn(record[container] ?? {}, key),
      false,
      `Case recorded ${container}.${key}`
    );
}
function cleanCase(record) {
  assertNoCaptureErrors(record);
  assert.deepEqual(record.errors, [], 'Browser case errors');
}

export function inspectBootstrapMotionArtifacts(directory) {
  const modalDirectory = path.join(directory, 'bootstrap-modal-presence');
  const progressDirectory = path.join(directory, 'bootstrap-progress-width');
  const source = {
    modal: sourceFiles(modalDirectory, true),
    progress: sourceFiles(progressDirectory, false),
  };
  nonempty(path.join(progressDirectory, 'shadow-artifact.json'));
  const modal = MODAL_CASES.map((required) => {
    const record = json(path.join(modalDirectory, `${required.file}.json`));
    cleanCase(record);
    assert.equal(record.status, 'passed');
    assert.equal(record.scope, 'document');
    assert.equal(record.family, required.family);
    assert.equal(record.name, required.name);
    assert.equal(record.bundleSha256, source.modal.bundleSha256);
    assert.equal(record.cssSha256, source.modal.cssSha256);
    assert.ok(
      Array.isArray(record.images) && record.images.length >= 2,
      'Missing sample/terminal image list'
    );
    assert.equal(
      new Set(record.images.map((image) => image.file)).size,
      record.images.length,
      'Duplicate image identity'
    );
    const images = record.images.map((image) => {
      const readback = png(modalDirectory, image.file);
      assert.equal(image.sha256, readback.sha256, 'PNG digest mismatch');
      assert.ok(image.before && image.after, 'Missing actual PNG capture interval');
      return readback;
    });
    assert.equal(
      images.filter((image) => image.file === `${required.file}-terminal.png`).length,
      1,
      'Missing terminal PNG'
    );
    return { ...required, images };
  });
  const progress = PROGRESS_CASES.map((required) => {
    const record = json(path.join(progressDirectory, `${required.file}.json`));
    cleanCase(record);
    assert.equal(record.scope, required.scope);
    assert.equal(record.name, required.name);
    assert.equal(record.bundleSha256, source.progress.bundleSha256);
    assert.equal(record.cssSha256, source.progress.cssSha256);
    return { ...required, image: png(progressDirectory, `${required.file}.png`) };
  });
  const negative = json(path.join(progressDirectory, 'shadow-split-unsupported.json'));
  assert.equal(negative.scope, 'shadow-split');
  assert.equal(negative.disposition, 'unsupported');
  assert.equal(negative.countsAsVisualAcceptance, false);
  assertNoCaptureErrors(negative);
  assert.equal(negative.bundleSha256, source.progress.bundleSha256);
  assert.equal(negative.cssSha256, source.progress.cssSha256);
  assert.ok(
    Array.isArray(negative.errors) && negative.errors.length > 0,
    'Missing expected split rejection'
  );
  assert.ok(
    negative.errors.every((error) => String(error).includes(SPLIT_REJECTION_REASON)),
    'Unexpected split admission error'
  );
  return {
    source,
    modal,
    progress,
    splitNegative: {
      disposition: 'unsupported',
      countsAsVisualAcceptance: false,
      reason: SPLIT_REJECTION_REASON,
      image: png(progressDirectory, 'shadow-split-unsupported.png'),
    },
  };
}

export function captureBootstrapMotionSource(root = repositoryRoot, env = process.env) {
  return {
    expectedSha: env.PROTO_UI_EXPECTED_HEAD_SHA ?? null,
    checkoutSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirty:
      execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], {
        cwd: root,
        encoding: 'utf8',
      }).trim() !== '',
    inputs: Object.fromEntries(
      BOOTSTRAP_MOTION_SUITES.map(({ file }) => [file, sha256(readFileSync(path.join(root, file)))])
    ),
    runId: env.GITHUB_RUN_ID ?? null,
    runAttempt: env.GITHUB_RUN_ATTEMPT ?? null,
  };
}
export function assertBootstrapMotionSource(before, after) {
  assert.match(before?.expectedSha ?? '', /^[a-f0-9]{40}$/, 'Missing expected commit');
  assert.equal(before.checkoutSha, before.expectedSha, 'Checkout differs from the requested head');
  assert.equal(before.dirty, false, 'Dirty checkout cannot certify the requested head');
  assert.deepEqual(after, before, 'Source or run context changed during the motion lane');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, directory] = process.argv.slice(2);
  assert.ok(
    directory && ['source', 'check'].includes(command) && process.argv.length === 4,
    'Usage: node scripts/test/check-bootstrap-motion-evidence.mjs <source|check> EVIDENCE_DIRECTORY'
  );
  mkdirSync(directory, { recursive: true });
  if (command === 'source') {
    const source = captureBootstrapMotionSource();
    writeJson(path.join(directory, 'source-before.json'), source, { flag: 'wx' });
    assertBootstrapMotionSource(source, source);
  } else {
    const failures = [];
    const receipt = {
      schemaVersion: 1,
      status: 'failed',
      stepOutcome: process.env.EVIDENCE_STEP_STATUS ?? null,
      expectedSha: process.env.PROTO_UI_EXPECTED_HEAD_SHA ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      scope:
        '11 source/module/host/browser files; 12 native positive cases and one experimental split rejection. No split visual, physical refresh, non-Web, Compiler or full-family acceptance.',
    };
    try {
      receipt.sourceBefore = json(path.join(directory, 'source-before.json'));
      receipt.sourceAfter = captureBootstrapMotionSource();
      assertBootstrapMotionSource(receipt.sourceBefore, receipt.sourceAfter);
    } catch (error) {
      failures.push(`source: ${message(error)}`);
    }
    try {
      const reportBytes = nonempty(path.join(directory, 'vitest.json'));
      receipt.reportSha256 = sha256(reportBytes);
      receipt.execution = await inspectBootstrapMotionReport(
        JSON.parse(reportBytes.toString('utf8')),
        {
          stepOutcome: receipt.stepOutcome,
        }
      );
      failures.push(...receipt.execution.failures);
    } catch (error) {
      failures.push(`execution: ${message(error)}`);
    }
    try {
      receipt.artifacts = inspectBootstrapMotionArtifacts(directory);
    } catch (error) {
      failures.push(`artifacts: ${message(error)}`);
    }
    receipt.failures = failures;
    receipt.status = failures.length ? 'failed' : 'passed';
    writeJson(path.join(directory, 'manifest.json'), receipt);
    if (failures.length) {
      console.error(failures.join('\n'));
      process.exitCode = 1;
    } else
      console.log(
        `Bootstrap motion: 11 files / ${totalCases} assertions executed; native artifacts verified.`
      );
  }
}
