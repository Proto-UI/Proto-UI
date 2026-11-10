import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyVariant, readPlan, sha256, studyDirectory, studyFiles } from './source-variant.mjs';

const requireFact = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const failed = (checks) => checks.filter((check) => check.status === 'failed');

// Inputs here are normalized observations, not source-derived expected answers.
export function classifyCell(plan, variant, baseline, cell) {
  const result = { variantId: variant.id, kind: variant.kind, verdict: 'unresolved', reason: null };
  if (!baseline.ready || !cell.ready)
    return { ...result, reason: !baseline.ready ? `baseline: ${baseline.reason}` : cell.reason };
  if (failed(baseline.existing).length || baseline.oracle.some((item) => item.error || item.cleanupError))
    return { ...result, verdict: 'baseline-failure', reason: 'Baseline failures are retained and excluded from detection/false-alarm denominators.' };
  if (!same(baseline.existing.map((item) => item.fullName).sort(), cell.existing.map((item) => item.fullName).sort()))
    return { ...result, reason: 'Existing check inventory changed.' };
  const newFailures = failed(cell.existing);
  const details = { ...result, existingFailures: newFailures, oracle: cell.oracle };
  if (variant.patch && !cell.transformed)
    return { ...details, verdict: variant.kind === 'injected-broken' ? 'ineffective-mutation' : 'unresolved', reason: 'Declared source mutation was never transformed; no exercised effect is claimed.' };
  if (cell.oracle.some((item) => item.cleanupError || (item.error && !item.firstDivergence)))
    return { ...details, reason: 'Oracle setup, non-assertion or cleanup failure; no behavioral detection claim.' };
  if (variant.kind !== 'injected-broken') {
    if (cell.oracle.some((item) => item.firstDivergence))
      return { ...details, reason: 'A proposed legal/control case disagrees with the oracle; review the rule and fixture separately.' };
    return { ...details, verdict: newFailures.length ? 'false-alarm' : 'accepted-control' };
  }
  const target = cell.oracle.find((item) => item.id === variant.caseId);
  if (!target?.firstDivergence)
    return { ...details, verdict: 'ineffective-mutation', reason: 'Target journey did not observe the intended violation; repaired/equivalent effects are not detected regressions.' };
  const criterion = plan.cases.find((item) => item.id === variant.caseId);
  const diagnostics = newFailures.filter((item) => criterion.existingCheckFragments.some((fragment) => item.fullName.includes(fragment)));
  return {
    ...details, verdict: diagnostics.length ? 'caught' : 'missed', criterion: criterion.criterion,
    firstDivergence: target.firstDivergence, criterionLinkedExistingDiagnostics: diagnostics,
    unrelatedExistingFailures: newFailures.filter((item) => !diagnostics.includes(item)),
  };
}

export function summarize(plan, cells) {
  const baseline = cells.baseline ?? { ready: false, reason: 'Missing baseline.' };
  const outcomes = plan.variants.map((variant) => classifyCell(plan, variant, baseline, cells[variant.id] ?? { ready: false, reason: 'Cell not executed or unavailable.' }));
  const count = (kind, verdict) => outcomes.filter((item) => item.kind === kind && item.verdict === verdict).length;
  const caught = count('injected-broken', 'caught');
  const missed = count('injected-broken', 'missed');
  const falseAlarms = count('legal-customization', 'false-alarm');
  const acceptedLegal = count('legal-customization', 'accepted-control');
  return {
    schemaVersion: 1, studyId: plan.studyId, visibility: plan.visibility,
    expectationReview: plan.expectationReview, outcomes,
    detection: { caught, missed, denominator: caught + missed, rate: caught + missed ? caught / (caught + missed) : null },
    falseAlarms: { rejectedLegal: falseAlarms, acceptedLegal, denominator: falseAlarms + acceptedLegal, rate: falseAlarms + acceptedLegal ? falseAlarms / (falseAlarms + acceptedLegal) : null },
    exclusions: outcomes.filter((item) => ['unresolved', 'baseline-failure', 'ineffective-mutation'].includes(item.verdict)),
    heldOut: { status: 'not-provided', denominator: null },
    repairs: { status: 'not-run', failed: null, neutral: null, cost: null },
    untested: ['Native mutation input/paint', 'Assistive technology', 'Other Adapter/host profiles', 'Generated Dialog', 'Paired Agent repair/maintenance and repeated-run variance'],
    interpretation: 'Public calibration, pending independent expectation review. No causal improvement, real product bug, stable conformance or Issue completion follows from these classifications.',
  };
}

export function loadCell(directory, plan, variant) {
  const json = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const manifest = json('cell.json');
  const execution = json('execution.json');
  const integrity = json('integrity.json');
  const reportBytes = fs.readFileSync(path.join(directory, 'vitest.json'));
  const report = JSON.parse(reportBytes);
  requireFact(manifest.studyId === plan.studyId && manifest.variantId === variant.id && execution.variantId === variant.id && manifest.kind === variant.kind, 'Cell identity mismatch.');
  const planBytes = fs.readFileSync(path.join(directory, 'sources', studyDirectory, 'plan.json'));
  requireFact(manifest.planSha256 === sha256(planBytes) && same(JSON.parse(planBytes), plan), 'Plan changed between cells.');
  const expectedInputs = [...Object.keys(plan.inputs), ...studyFiles].sort();
  requireFact(same(Object.keys(manifest.inputs).sort(), expectedInputs), 'Source inventory differs from frozen scope.');
  for (const [relative, hash] of Object.entries(manifest.inputs)) {
    requireFact(sha256(fs.readFileSync(path.join(directory, 'sources', relative))) === hash, `Source snapshot mismatch: ${relative}`);
    if (plan.inputs[relative]) requireFact(hash === plan.inputs[relative], `Frozen input mismatch: ${relative}`);
  }
  requireFact(execution.spawnError === null && execution.signal === null && same(execution.sourceDrift, []), 'Runner failure, signal or source drift.');
  requireFact(integrity.phase === 'process-exit' && integrity.finishedCalls === 1 && integrity.closeStarted && integrity.closeFinished && !integrity.processTimedOut && !integrity.cancelled, 'Missing complete process-exit receipt.');
  requireFact(same(integrity.runnerErrors, []) && same(integrity.unhandledErrors, []) && integrity.files.every((file) => same(file.suiteErrors, [])), 'Runner/unhandled/suite error.');
  requireFact(integrity.reportSha256 === sha256(reportBytes) && integrity.reporterSha256 === plan.inputs['scripts/test/dialog-run-integrity-reporter.mjs'], 'Reporter/report digest mismatch.');
  requireFact(integrity.exitCode === execution.exitCode && [0, 1].includes(execution.exitCode), 'Unbound or unexpected exit status.');
  const suites = { ...plan.existingSuites, [plan.oracleSuite]: plan.cases.length };
  requireFact(report.testResults.length === Object.keys(suites).length && integrity.files.length === Object.keys(suites).length, 'Missing or extra test files.');
  const existing = [];
  const oracleTests = [];
  for (const [relative, count] of Object.entries(suites)) {
    const matches = report.testResults.filter((file) => file.name.replaceAll('\\', '/').endsWith(`/${relative}`));
    requireFact(matches.length === 1 && matches[0].assertionResults.length === count, `Executed inventory mismatch: ${relative}`);
    const receipts = integrity.files.filter((file) => file.path === relative);
    requireFact(receipts.length === 1 && ['pass', 'fail'].includes(receipts[0].state), `Unexecuted file: ${relative}`);
    for (const assertion of matches[0].assertionResults) {
      requireFact(['passed', 'failed'].includes(assertion.status), `Skipped/pending/unexecuted assertion: ${assertion.fullName}`);
      (relative === plan.oracleSuite ? oracleTests : existing).push({
        fullName: assertion.fullName, status: assertion.status, diagnostics: assertion.failureMessages,
      });
    }
  }
  requireFact(new Set(existing.map((item) => item.fullName)).size === existing.length, 'Duplicate check identity.');
  const total = existing.length + oracleTests.length;
  requireFact(report.numTotalTests === total && report.numPassedTests + report.numFailedTests === total && report.numPendingTests === 0 && report.numTodoTests === 0, 'Incomplete report totals.');
  requireFact(execution.exitCode === (report.numFailedTests ? 1 : 0) && report.success === (report.numFailedTests === 0), 'Exit status does not match assertion outcomes.');
  const oracle = fs.readFileSync(path.join(directory, 'oracle.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  requireFact(oracle.length === plan.cases.length && new Set(oracle.map((item) => item.id)).size === oracle.length, 'Missing/duplicate oracle observation.');
  for (const criterion of plan.cases) {
    const observation = oracle.find((item) => item.id === criterion.id);
    const tests = oracleTests.filter((item) => item.fullName.trim() === criterion.id);
    requireFact(observation?.finished && tests.length === 1, `Unfinished oracle: ${criterion.id}`);
    requireFact(tests[0].status === (observation.error || observation.cleanupError ? 'failed' : 'passed'), `Oracle/test result mismatch: ${criterion.id}`);
  }
  let transformed = false;
  if (variant.patch) {
    const original = fs.readFileSync(path.join(directory, 'sources', variant.patch.path), 'utf8');
    const injected = fs.readFileSync(path.join(directory, 'injected', variant.patch.path), 'utf8');
    requireFact(injected === applyVariant(original, variant) && manifest.mutation?.beforeSha256 === sha256(original) && manifest.mutation?.afterSha256 === sha256(injected), 'Mutation preimage/postimage mismatch.');
    if (fs.existsSync(path.join(directory, 'transforms.json'))) {
      const transformation = json('transforms.json');
      requireFact(transformation.variantId === variant.id && same(transformation.paths, [variant.patch.path]) && transformation.beforeSha256 === sha256(original) && transformation.afterSha256 === sha256(injected), 'Transform identity mismatch.');
      transformed = true;
    }
  } else requireFact(manifest.mutation === null, 'Baseline must not carry a mutation.');
  return { ready: true, existing, oracle, transformed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/analysis/dialog-conformance-study/report.mjs <run-directory>');
  const directory = path.resolve(process.argv[2]);
  const plan = readPlan(root);
  const cells = {};
  for (const variant of plan.variants) {
    try { cells[variant.id] = loadCell(path.join(directory, variant.id), plan, variant); }
    catch (error) { cells[variant.id] = { ready: false, reason: String(error?.stack ?? error) }; }
  }
  const report = summarize(plan, cells);
  fs.writeFileSync(path.join(directory, 'study-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  if (report.exclusions.length) process.exitCode = 1;
}
