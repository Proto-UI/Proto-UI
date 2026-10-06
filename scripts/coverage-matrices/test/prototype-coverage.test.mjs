import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { root, dataPath, markdownPath, validate, render } from '../prototype-coverage.mjs';
const baseline = JSON.parse(fs.readFileSync(path.join(root, dataPath), 'utf8'));
const copy = () => structuredClone(baseline);
test('source-bound coverage inventory and generated view agree', () => {
  assert.deepEqual(validate(baseline), []);
  assert.equal(fs.readFileSync(path.join(root, markdownPath), 'utf8'), render(baseline));
});
test('comparison denominator and alias duplication fail closed', () => {
  const data = copy();
  data.comparisonRows.push(structuredClone(data.comparisonRows[0]));
  const errors = validate(data);
  assert(errors.some((x) => x.includes('Duplicate comparison')));
  assert(errors.some((x) => x.includes('denominator') || x.includes('Union')));
});
test('a missing projection column is rejected', () => {
  const data = copy();
  delete data.projectionRows[0].families['liquid-glass'];
  assert(validate(data).some((x) => x.includes('Missing projection column')));
});
test('unresolved consumer and missing source are rejected', () => {
  const data = copy();
  data.comparisonRows[0].consumerRows.push('harness.not-a-real-row');
  data.prototypeInventory.base.button.sourceFiles.push(
    'packages/prototypes/base/src/does-not-exist.proto.ts'
  );
  const errors = validate(data);
  assert(errors.some((x) => x.includes('Unresolved consumer')));
  assert(errors.some((x) => x.includes('Missing source')));
});
test('duplicate P identities and invented stable totals are rejected', () => {
  const data = copy();
  data.prototypeInventory.base.button.entityIds.push('P-BASE-BUTTON');
  data.counts.catalogActive = 1;
  const errors = validate(data);
  assert(errors.some((x) => x.includes('Duplicate P')));
  assert(errors.some((x) => x.includes('lifecycle totals')));
});
test('migration cannot silently mark retained work closed', () => {
  const data = copy();
  data.migrationLedger[0].action = 'close-as-fixed';
  assert(validate(data).some((x) => x.includes('Missing migration disposition')));
});
