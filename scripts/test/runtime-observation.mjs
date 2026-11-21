import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';

export function runtimeSourceSnapshot(root) {
  const git = (args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const diff = git(['diff', 'HEAD', '--binary', '--no-ext-diff']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
  const hash = createHash('sha256').update(diff);
  for (const file of untracked) {
    const absolute = path.join(root, file);
    const content = lstatSync(absolute).isSymbolicLink()
      ? readlinkSync(absolute)
      : readFileSync(absolute);
    hash.update(file).update('\0').update(content);
  }
  return {
    checkoutSha: git(['rev-parse', 'HEAD']).toString().trim(),
    treeSha: git(['rev-parse', 'HEAD^{tree}']).toString().trim(),
    dirty: diff.length > 0 || untracked.length > 0,
    worktreeSha256: hash.digest('hex'),
  };
}

export function readOptionalJson(file) {
  if (!file || !existsSync(file)) return { value: null, error: null };
  try {
    return { value: JSON.parse(readFileSync(file, 'utf8')), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function runtimeObservation({
  selection,
  root,
  report,
  progress,
  sourceBefore,
  sourceAfter,
  exitCode = null,
  signal = null,
  error = null,
}) {
  const sourceStable = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  const files = report?.testResults ?? [];
  const observed = files.map((file) => ({
    suite: path.relative(root, file.name).replaceAll('\\', '/'),
    status: file.status,
    message: file.message ?? '',
    assertions: (file.assertionResults ?? []).map((test) => ({
      name: test.fullName,
      status: test.status,
      durationMs: test.duration ?? null,
      failureMessages: test.failureMessages ?? [],
    })),
  }));
  const reportedSuites = observed.map(({ suite }) => suite);
  const missingSuites = selection.suites.filter((suite) => !reportedSuites.includes(suite));
  const unexpectedSuites = reportedSuites.filter((suite) => !selection.suites.includes(suite));
  const duplicateSuites = reportedSuites.filter(
    (suite, index) => reportedSuites.indexOf(suite) !== index
  );
  const completeInventory =
    Boolean(report) &&
    missingSuites.length === 0 &&
    unexpectedSuites.length === 0 &&
    duplicateSuites.length === 0;
  const assertions = observed.flatMap((file) => file.assertions);
  return {
    schemaVersion: 1,
    selection,
    sourceBefore,
    sourceAfter,
    sourceStable,
    execution: signal ? 'interrupted' : report ? 'reported' : 'no-terminal-report',
    exitCode,
    signal,
    error,
    completeInventory,
    missingSuites,
    unexpectedSuites,
    duplicateSuites,
    counts: {
      selectedSuites: selection.suites.length,
      reportedSuites: reportedSuites.length,
      passed: assertions.filter((test) => test.status === 'passed').length,
      failed: assertions.filter((test) => test.status === 'failed').length,
      skipped: assertions.filter((test) =>
        ['pending', 'skipped', 'todo', 'disabled'].includes(test.status)
      ).length,
    },
    // Assertion failure is an observation, not an automatic product-bug label.
    suites: observed,
    checkpoint: progress,
    acceptance: 'requires-original-strict-gate',
  };
}
