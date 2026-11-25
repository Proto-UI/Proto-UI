import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyResult, compareReports } from './library-profile-inventory.mjs';

const diagnostic = (category) => ({ code: 'fixture', category, message: category });
const schema = 'proto-ui.library-profile-inventory.v2';
const row = (status, extra = {}) => ({
  entry: 'packages/prototypes/base/src/button/button.proto.ts',
  profile: 'react',
  entrySha256: 'old',
  status,
  failureKind: null,
  firstDiagnostic: null,
  ...extra,
});
const report = (rows) => ({ schema, rows, universeFingerprint: 'bound-fixture' });

test('an unsupported diagnostic cannot conceal a compiler defect or invalid input', () => {
  assert.equal(
    classifyResult({ ok: false, diagnostics: [diagnostic('unsupported-input')] }).status,
    'UNSUPPORTED'
  );
  const mixed = classifyResult({
    ok: false,
    diagnostics: [diagnostic('unsupported-input'), diagnostic('compiler-defect')],
  });
  assert.equal(mixed.status, 'FAIL');
  assert.equal(mixed.failureKind, 'compiler-defect');
  assert.equal(
    mixed.firstDiagnostic.category,
    'unsupported-input',
    'Original diagnostic order remains intact'
  );
  assert.equal(mixed.diagnostics.length, 2);
  assert.equal(
    classifyResult({
      ok: false,
      diagnostics: [diagnostic('unsupported-input'), diagnostic('invalid-input')],
    }).failureKind,
    'invalid-input'
  );
  assert.equal(
    classifyResult({ ok: false, diagnostics: [] }).status,
    'FAIL',
    'An empty failure is not support or success'
  );
});

test('ratchet refuses removed, unexecuted and source-changed prior PASS rows', () => {
  const baseline = report([row('PASS')]);
  for (const current of [
    report([]),
    report([row('UNTESTED')]),
    report([row('UNSUPPORTED', { entrySha256: 'changed' })]),
  ]) {
    const comparison = compareReports(baseline, current);
    assert.equal(comparison.ok, false);
    assert.equal(comparison.regressions.length, 1);
  }
  assert.equal(
    compareReports(baseline, report([row('UNSUPPORTED', { entrySha256: 'changed' })])).sourceChanges
      .length,
    1
  );
  const removedUnsupported = compareReports(report([row('UNSUPPORTED')]), report([]));
  assert.equal(
    removedUnsupported.ok,
    false,
    'Removing an unsupported row cannot shrink the denominator silently'
  );
  assert.equal(removedUnsupported.missingBaselineRows.length, 1);
});

test('new defects fail separately from admission gains; duplicate identities are rejected', () => {
  const baseline = report([row('UNSUPPORTED')]);
  const failed = compareReports(
    baseline,
    report([
      row('FAIL', {
        failureKind: 'compiler-defect',
        firstDiagnostic: diagnostic('compiler-defect'),
      }),
    ])
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.newDefects.length, 1);
  const improved = compareReports(baseline, report([row('PASS')]));
  assert.equal(improved.ok, true);
  assert.equal(improved.improvements.length, 1);
  assert.throws(() => compareReports(baseline, report([row('PASS'), row('PASS')])), /Duplicate/);
});

test('current unsupported codes cannot conceal a type error or native builder defect', () => {
  const unsupported = {
    code: 'PUI_REACT_UNSUPPORTED',
    severity: 'error',
    category: 'codegen',
    message: 'unlowered operation',
  };
  assert.equal(classifyResult({ ok: false, diagnostics: [unsupported] }).status, 'UNSUPPORTED');
  assert.equal(
    classifyResult({
      ok: false,
      diagnostics: [
        unsupported,
        { code: 'TS2322', severity: 'error', category: 'typecheck', message: 'invalid source' },
      ],
    }).failureKind,
    'invalid-input'
  );
  assert.equal(
    classifyResult({
      ok: false,
      diagnostics: [
        unsupported,
        {
          code: 'PUI_GPUI_BUILDER003',
          severity: 'error',
          category: 'codegen',
          message: 'builder failure',
        },
      ],
    }).failureKind,
    'compiler-defect'
  );
  assert.equal(
    classifyResult({ ok: false, diagnostics: [{ ...unsupported, severity: 'warning' }] }).status,
    'FAIL'
  );
});
