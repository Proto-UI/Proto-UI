// Source-bound whole-library admission receipts for the coordinated CI cycle.
// The current compiler supplies component targets; retired target obligations remain explicit. No accepted baseline is
// invented; UNSUPPORTED/UNIMPLEMENTED remain explicit admission boundaries.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyResult } from '../compiler/library-profile-inventory.mjs';

export const SHARDS = 4;
const root = fileURLToPath(new URL('../../', import.meta.url));
const inventory = path.join(root, 'scripts/compiler/library-profile-inventory.mjs');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const save = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const key = (entry, profile) => `${entry}\0${profile}`;

function identity() {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.equal(revision.status, 0, revision.stderr);
  const sourceRevision = revision.stdout.trim();
  assert.equal(sourceRevision, process.env.GITHUB_SHA, 'CI checkout differs from requested SHA');
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
  const attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  assert.ok(Number.isSafeInteger(attempt) && attempt > 0);
  return { sourceRevision, runId: process.env.GITHUB_RUN_ID, attempt };
}

export function selectShardAttempts(names, expected) {
  const pattern = /^compiler-library-([0-9a-f]{40})-(\d+)-shard-(\d+)-attempt-(\d+)$/;
  const selected = new Map();
  for (const name of names) {
    const match = name.match(pattern);
    assert.ok(match, `Unexpected inventory artifact ${name}`);
    const [, revision, runId, slotText, attemptText] = match;
    const slot = Number(slotText),
      attempt = Number(attemptText);
    assert.equal(revision, expected.sourceRevision, 'Foreign source artifact');
    assert.equal(runId, expected.runId, 'Foreign run artifact');
    assert.ok(slot >= 0 && slot < SHARDS, 'Unknown shard');
    assert.ok(attempt > 0 && attempt <= expected.attempt, 'Foreign/future attempt');
    const before = selected.get(slot);
    assert.notEqual(before?.attempt, attempt, 'Duplicate shard attempt');
    if (!before || before.attempt < attempt) selected.set(slot, { name, slot, attempt });
  }
  assert.equal(selected.size, SHARDS, 'Missing whole-library shard');
  return [...selected.values()].sort((left, right) => left.slot - right.slot);
}

export function assertCompleteInventory(report, expected) {
  assert.equal(report.schema, expected.schema);
  assert.equal(report.universeFingerprint, expected.universeFingerprint);
  assert.deepEqual(report.binding, expected.binding, 'Inventory source/tool identity changed');
  assert.deepEqual(report.profiles, expected.profiles, 'Public profile denominator changed');
  const entries = new Map(expected.entries.map((entry) => [entry.entry, entry]));
  const profiles = new Map(expected.profiles.map((profile) => [profile.id, profile]));
  assert.ok(entries.size > 0 && profiles.size > 0);
  assert.equal(entries.size, expected.entries.length);
  assert.equal(profiles.size, expected.profiles.length);
  assert.equal(
    report.rows.length,
    entries.size * profiles.size,
    'Truncated entry/profile denominator'
  );
  const observed = new Set();
  const counts = { PASS: 0, FAIL: 0, UNSUPPORTED: 0, UNIMPLEMENTED: 0, UNTESTED: 0, ANALYZED: 0 };
  for (const row of report.rows) {
    const entry = entries.get(row.entry),
      profile = profiles.get(row.profile);
    assert.ok(entry && profile, 'Foreign entry/profile row');
    assert.equal(row.entrySha256, entry.sha256, 'Authored input changed');
    assert.equal(row.family, entry.family);
    const rowKey = key(row.entry, row.profile);
    assert.ok(!observed.has(rowKey), 'Duplicate entry/profile row');
    observed.add(rowKey);
    assert.ok(Object.hasOwn(counts, row.status));
    counts[row.status]++;
    if (!profile.implemented) {
      assert.equal(row.status, 'UNIMPLEMENTED', 'Private emitter cannot admit a public profile');
      assert.equal(row.execution, 'profile-declaration-only');
      assert.deepEqual(row.diagnostics, profile.declarationDiagnostics);
    } else {
      assert.ok(
        ['PASS', 'UNSUPPORTED', 'FAIL', 'ANALYZED'].includes(row.status),
        'Implemented row is UNTESTED'
      );
      assert.equal(row.execution, 'compileFile-source-to-emitter');
      assert.ok(row.closure?.sha256 && row.elapsedMs >= 0, 'Missing actual compilation receipt');
      if (row.status === 'PASS') {
        assert.equal(row.output?.profile, row.profile, 'PASS requires its emitted profile');
        assert.ok(row.nativeEmittedPrototypes > 0, 'PASS requires at least one emitted prototype');
        assert.equal(row.nativeEmittedPrototypes, row.prototypeDeclarations);
        assert.ok(row.output.artifacts.count > 0, 'PASS requires a native source artifact');
        assert.equal(row.failureKind, null);
        assert.equal(row.firstDiagnostic, null);
        assert.deepEqual(row.diagnostics, []);
      } else if (row.status === 'ANALYZED') {
        assert.equal(row.analysisKind, 'hook-only');
        assert.equal(row.prototypeDeclarations, 0);
        assert.ok(row.authoredHookDeclarations > 0);
        assert.equal(row.nativeEmittedPrototypes, 0);
        assert.equal(row.output, undefined, 'Analysis is not emitted component source');
      } else {
        assert.equal(row.output, undefined, 'A refused input cannot claim an emitted output');
        assert.equal(row.nativeEmittedPrototypes, 0, 'Refusal cannot claim native emission');
        const classified = classifyResult({ ok: false, diagnostics: row.diagnostics });
        assert.equal(row.status, classified.status);
        assert.equal(row.failureKind, classified.failureKind);
        assert.deepEqual(row.firstDiagnostic, classified.firstDiagnostic);
      }
    }
  }
  assert.equal(
    report.counts.executionVerifiedPrototypes,
    0,
    'Source inventory does not execute generated components'
  );
  assert.equal(
    report.counts.nativeEmittedPrototypes,
    report.rows.reduce((sum, row) => sum + (row.nativeEmittedPrototypes ?? 0), 0)
  );
  assert.equal(report.counts.entries, entries.size);
  const families = {};
  for (const entry of entries.values()) families[entry.family] = (families[entry.family] ?? 0) + 1;
  assert.deepEqual(report.counts.families, families);
  assert.equal(report.counts.profiles, profiles.size);
  assert.equal(
    report.counts.implementedProfiles,
    expected.profiles.filter((p) => p.implemented).length
  );
  assert.equal(report.counts.rows, report.rows.length);
  assert.deepEqual(report.counts.statuses, counts);
  const defects = report.rows.filter((row) => row.failureKind === 'compiler-defect').length;
  assert.equal(report.counts.compilerDefects, defects);
  assert.equal(defects, 0, 'Compiler defects cannot pass the inventory gate');
  assert.equal(counts.FAIL, 0, 'Refused invalid/failed inputs remain a failing inventory');
  assert.equal(report.admissionCoverageComplete, true, 'Whole-library coverage is incomplete');
  assert.equal(
    report.execution.missingProcessReceipts.length,
    0,
    'Missing process terminal receipts'
  );
  assert.equal(report.execution.recordedAttempts, report.execution.attempts.length);
  assert.equal(report.execution.failedAttempts, 0, 'Earlier execution failure must remain red');
  const executed = new Set();
  for (const attempt of report.execution.attempts) {
    assert.equal(attempt.status, 0, 'Worker did not exit successfully');
    assert.equal(attempt.signal, null, 'Signalled worker cannot pass');
    assert.equal(attempt.error, null, 'Worker transport/resource error');
    assert.ok(attempt.resources?.final, 'Missing final worker resources');
    assert.ok(entries.has(attempt.entry));
    assert.ok(attempt.profiles.length > 0);
    for (const profile of attempt.profiles) {
      assert.ok(profiles.get(profile)?.implemented);
      const rowKey = key(attempt.entry, profile);
      assert.ok(!executed.has(rowKey), 'Duplicate execution attempt cannot disappear');
      executed.add(rowKey);
    }
  }
  assert.equal(
    executed.size,
    entries.size * expected.profiles.filter((p) => p.implemented).length,
    'Worker terminal receipts do not cover the actual compilation denominator'
  );
  return {
    counts,
    admissionCoverageComplete: true,
    allImplementedEntriesAdmitted: counts.UNSUPPORTED === 0,
    acceptedBaseline: null,
    scope:
      'Complete source-to-emitter inventory with no failed rows/processes. Explicit unsupported/unimplemented rows remain; no runtime, native, visual or full Issue acceptance.',
  };
}

function command(args, logPath) {
  const result = spawnSync(process.execPath, [inventory, ...args], {
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  save(logPath, {
    args,
    status: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  return result;
}

function gate(directory, output) {
  mkdirSync(output, { recursive: true });
  const receipt = {
    ok: false,
    acceptedBaseline: null,
    scope: 'Complete library/profile inventory CI gate',
  };
  try {
    const expectedIdentity = identity();
    receipt.identity = expectedIdentity;
    const expectedRun = path.join(output, 'expected');
    const planned = command(
      ['--output', expectedRun, '--plan-only', '--heap-mb', '1536'],
      path.join(output, 'plan-command.json')
    );
    assert.equal(planned.status, 0, planned.stderr);
    assert.equal(planned.signal, null);
    const expected = read(path.join(expectedRun, 'plan.json'));
    assert.equal(expected.binding.revision, expectedIdentity.sourceRevision);
    const selected = selectShardAttempts(readdirSync(directory), expectedIdentity);
    receipt.selected = selected;
    const runs = [];
    for (const choice of selected) {
      const artifact = path.join(directory, choice.name);
      const ci = read(path.join(artifact, 'ci.json'));
      assert.deepEqual(ci.identity, { ...expectedIdentity, attempt: choice.attempt });
      assert.equal(ci.slot, choice.slot);
      assert.equal(ci.shards, SHARDS);
      const run = path.join(artifact, 'inventory');
      const plan = read(path.join(run, 'plan.json'));
      assert.equal(plan.universeFingerprint, expected.universeFingerprint);
      assert.deepEqual(plan.entries, expected.entries, 'Shard reduced the authored denominator');
      assert.deepEqual(plan.profiles, expected.profiles, 'Shard reduced the public registry');
      assert.deepEqual(
        plan.selection,
        {
          entries: expected.entries
            .filter((_, index) => index % SHARDS === choice.slot)
            .map((row) => row.entry),
          profiles: expected.profiles.map((row) => row.id),
          shard: [choice.slot, SHARDS],
        },
        'Shard selection does not match the complete deterministic partition'
      );
      runs.push(run);
    }
    const mergedPath = path.join(output, 'merged.json');
    const merged = command(
      ['--merge', mergedPath, ...runs],
      path.join(output, 'merge-command.json')
    );
    receipt.reportSha256 = hash(mergedPath);
    receipt.result = assertCompleteInventory(read(mergedPath), expected);
    assert.equal(merged.status, 0, merged.stderr);
    assert.equal(merged.signal, null);
    const needs = JSON.parse(process.env.INVENTORY_CI_NEEDS ?? '{}');
    assert.equal(needs.inventory?.result, 'success', 'Failed/skipped/cancelled producer lane');
    for (const choice of selected) {
      const terminal = read(path.join(directory, choice.name, 'terminal.json'));
      assert.equal(terminal.jobStatus, 'success', 'Shard setup/execution did not succeed');
      assert.equal(terminal.steps.execute?.outcome, 'success');
      assert.deepEqual(terminal.identity, { ...expectedIdentity, attempt: choice.attempt });
    }
    receipt.ok = true;
  } catch (error) {
    receipt.error = String(error.stack ?? error);
    process.exitCode = 1;
  } finally {
    save(path.join(output, 'gate.json'), receipt);
    console.log(JSON.stringify(receipt));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, directory, extra] = process.argv.slice(2);
  assert.ok(directory, 'Expected an evidence directory');
  if (mode === 'init') {
    const slot = Number(extra);
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < SHARDS);
    save(path.join(directory, 'ci.json'), { identity: identity(), slot, shards: SHARDS });
  } else if (mode === 'finish') {
    save(path.join(directory, 'terminal.json'), {
      identity: identity(),
      jobStatus: process.env.INVENTORY_JOB_STATUS,
      steps: JSON.parse(process.env.INVENTORY_CI_STEPS ?? '{}'),
    });
  } else {
    assert.equal(mode, 'gate');
    assert.ok(extra, 'Expected gate output directory');
    gate(path.resolve(directory), path.resolve(extra));
  }
}
