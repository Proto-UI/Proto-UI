import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCompleteInventory,
  selectShardAttempts,
  SHARDS,
} from '../compiler-library-inventory.mjs';

// A small, independently authored receipt fixture tests acceptance of the
// protocol, not any generated component or compiler implementation result.
function fixture() {
  const profiles = [
    { id: 'public-one', implemented: true, declarationDiagnostics: [] },
    { id: 'public-two', implemented: true, declarationDiagnostics: [] },
    {
      id: 'public-unimplemented',
      implemented: false,
      declarationDiagnostics: [{ category: 'unsupported-input' }],
    },
  ];
  const entries = [
    { entry: 'base/button.proto.ts', family: 'base', sha256: 'source-one' },
    { entry: 'shadcn/button.proto.ts', family: 'shadcn', sha256: 'source-two' },
  ];
  const expected = {
    schema: 'proto-ui.library-profile-inventory.v1',
    universeFingerprint: 'independent-fixture',
    binding: { revision: 'a'.repeat(40) },
    entries,
    profiles,
  };
  const unsupported = {
    category: 'unsupported-input',
    code: 'fixture-refusal',
    message: 'Fixture boundary',
  };
  const rows = entries.flatMap((entry, index) =>
    profiles.map((profile) => ({
      entry: entry.entry,
      entrySha256: entry.sha256,
      family: entry.family,
      profile: profile.id,
      status: !profile.implemented
        ? 'UNIMPLEMENTED'
        : index === 1 && profile.id === 'public-two'
          ? 'UNSUPPORTED'
          : 'PASS',
      execution: profile.implemented ? 'compileFile-source-to-emitter' : 'profile-declaration-only',
      failureKind:
        profile.implemented && !(index === 1 && profile.id === 'public-two')
          ? null
          : 'unsupported-input',
      firstDiagnostic: index === 1 && profile.id === 'public-two' ? unsupported : null,
      diagnostics: !profile.implemented
        ? profile.declarationDiagnostics
        : index === 1 && profile.id === 'public-two'
          ? [unsupported]
          : [],
      ...(profile.implemented ? { closure: { sha256: 'closure' }, elapsedMs: 1 } : {}),
      ...(profile.implemented && !(index === 1 && profile.id === 'public-two')
        ? { output: { profile: profile.id } }
        : {}),
    }))
  );
  const report = {
    schema: expected.schema,
    universeFingerprint: expected.universeFingerprint,
    binding: expected.binding,
    profiles,
    rows,
    admissionCoverageComplete: true,
    counts: {
      entries: 2,
      families: { base: 1, shadcn: 1 },
      profiles: 3,
      implementedProfiles: 2,
      rows: 6,
      statuses: { PASS: 3, FAIL: 0, UNSUPPORTED: 1, UNIMPLEMENTED: 2, UNTESTED: 0 },
      compilerDefects: 0,
    },
    execution: {
      recordedAttempts: 2,
      failedAttempts: 0,
      missingProcessReceipts: [],
      attempts: entries.map((entry) => ({
        entry: entry.entry,
        profiles: ['public-one', 'public-two'],
        status: 0,
        signal: null,
        error: null,
        resources: { final: { peakRssKiB: 100 } },
      })),
    },
  };
  return { expected, report };
}

test('complete refusal accounting does not become an admitted-library or accepted-baseline claim', () => {
  const { expected, report } = fixture();
  const result = assertCompleteInventory(report, expected);
  assert.equal(result.admissionCoverageComplete, true);
  assert.equal(result.allImplementedEntriesAdmitted, false);
  assert.equal(result.acceptedBaseline, null);
  assert.equal(result.counts.UNSUPPORTED, 1);
  assert.equal(result.counts.UNIMPLEMENTED, 2);
});

test('removing a whole entry or unimplemented profile cannot reduce the expected denominator', () => {
  for (const filter of [(row) => row.family === 'base', (row) => row.status !== 'UNIMPLEMENTED']) {
    const { expected, report } = fixture();
    report.rows = report.rows.filter(filter);
    report.counts.rows = report.rows.length;
    assert.throws(() => assertCompleteInventory(report, expected), /denominator/);
  }
  const { expected, report } = fixture();
  report.rows[1] = structuredClone(report.rows[0]);
  assert.throws(() => assertCompleteInventory(report, expected), /Duplicate/);
});

test('UNTESTED and a compiler defect stay red even when supplied summary fields claim completion', () => {
  for (const status of ['UNTESTED', 'FAIL']) {
    const { expected, report } = fixture();
    report.rows[0].status = status;
    if (status === 'FAIL') {
      const diagnostic = {
        category: 'compiler-defect',
        code: 'defect',
        message: 'Original failure',
      };
      Object.assign(report.rows[0], {
        failureKind: 'compiler-defect',
        diagnostics: [diagnostic],
        firstDiagnostic: diagnostic,
      });
      delete report.rows[0].output;
      report.counts.statuses.PASS--;
      report.counts.statuses.FAIL++;
      report.counts.compilerDefects++;
    }
    assert.throws(() => assertCompleteInventory(report, expected), /UNTESTED|Compiler defects/);
  }
});

test('signals, missing process outcomes and dropped earlier executions cannot be hidden by PASS rows', () => {
  for (const alter of [
    (report) => {
      report.execution.attempts[0].signal = 'SIGKILL';
    },
    (report) => {
      report.execution.missingProcessReceipts.push('interrupted.request.json');
    },
    (report) => {
      report.execution.attempts.pop();
      report.execution.recordedAttempts--;
    },
    (report) => {
      report.execution.attempts[0].resources = null;
    },
    (report) => {
      report.execution.failedAttempts = 1;
    },
  ]) {
    const { expected, report } = fixture();
    alter(report);
    assert.throws(
      () => assertCompleteInventory(report, expected),
      /worker|Worker|process|execution/
    );
  }
});

test('the latest actual shard attempt wins; missing, foreign and future attempts fail closed', () => {
  const expected = { sourceRevision: 'a'.repeat(40), runId: '123', attempt: 2 };
  const name = (slot, attempt) =>
    `compiler-library-${expected.sourceRevision}-123-shard-${slot}-attempt-${attempt}`;
  const first = Array.from({ length: SHARDS }, (_, slot) => name(slot, 1));
  const selected = selectShardAttempts([...first, name(1, 2)], expected);
  assert.equal(
    selected[1].attempt,
    2,
    'A later failed attempt must be read rather than fall back to an older green'
  );
  assert.equal(
    selected[0].attempt,
    1,
    'A rerun need not fabricate executions of already successful shards'
  );
  assert.throws(() => selectShardAttempts(first.slice(1), expected), /Missing/);
  assert.throws(() => selectShardAttempts([...first, name(1, 3)], expected), /future/);
  assert.throws(() => selectShardAttempts([...first, first[0]], expected), /Duplicate/);
  assert.throws(
    () =>
      selectShardAttempts(
        first.map((item) => item.replace('-123-', '-456-')),
        expected
      ),
    /Foreign run/
  );
});
