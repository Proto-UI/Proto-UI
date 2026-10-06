import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  root,
  dataPath,
  markdownPath,
  validate,
  render,
  renderPlan,
  inheritedPrototypeIds,
} from '../prototype-coverage.mjs';
const baseline = JSON.parse(fs.readFileSync(path.join(root, dataPath), 'utf8'));
const copy = () => structuredClone(baseline);
test('source-bound coverage inventory and generated view agree', () => {
  assert.deepEqual(validate(baseline), []);
  assert.equal(fs.readFileSync(path.join(root, markdownPath), 'utf8'), render(baseline));
  assert.equal(
    fs.readFileSync(
      path.join(root, 'internal/coverage-matrices/finf-delivery-checklist.md'),
      'utf8'
    ),
    renderPlan(baseline)
  );
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

test('atomic inventory cannot disappear, omit an identity or invent a projection', () => {
  for (const mutate of [
    (d) => {
      d.atomicProjectionMapping = [];
    },
    (d) => {
      d.atomicProjectionMapping.pop();
    },
    (d) => {
      d.atomicProjectionMapping[0].projectionCells.shadcn.mappedCurrentIdentities = ['P-INVENTED'];
    },
  ]) {
    const d = copy();
    mutate(d);
    assert(validate(d).some((x) => x.includes('Atomic')));
  }
});
test('Base family rows and atomic columns must be unique and complete', () => {
  const d = copy();
  d.projectionRows[1] = structuredClone(d.projectionRows[0]);
  assert(
    validate(d).some(
      (x) => x.includes('projection family set') || x.includes('Duplicate projection')
    )
  );
  const e = copy();
  delete e.atomicProjectionMapping[0].projectionCells['liquid-glass'];
  assert(validate(e).some((x) => x.includes('Atomic projection columns')));
});
test('parsed inheritance never treats a Root prefix as a part identity', () => {
  const ids = inheritedPrototypeIds(
    'id: P-SHADCN-DIALOG-TRIGGER\ninherits:\n  prototypes:\n    - id: P-BASE-DIALOG-TRIGGER\n      note: P-BASE-DIALOG is an unrelated prose reference\n'
  );
  assert.deepEqual(ids, ['P-BASE-DIALOG-TRIGGER']);
  const d = copy();
  const row = d.atomicProjectionMapping.find((x) => x.baseIdentity === 'P-BASE-DIALOG');
  row.projectionCells.shadcn.mappedCurrentIdentities.push('P-SHADCN-DIALOG-TRIGGER');
  assert(validate(d).some((x) => x.includes('Atomic inheritance mismatch')));
});
test('arbitrary seven passed keys and unstructured evidence cannot complete a Finf item', () => {
  const d = copy();
  const item = d.deliveryPlan.items[0];
  item.complete = true;
  d.deliveryPlan.checkedCoreTodos = 1;
  item.gateResults = Object.fromEntries('abcdefg'.split('').map((x) => [x, 'passed']));
  item.evidence = ['claimed done'];
  const errors = validate(d);
  assert(errors.some((x) => x.includes('gate identity')));
  assert(errors.some((x) => x.includes('Incomplete Finf acceptance')));
});
test('correct gate keys still require bound receipts and independent evidence', () => {
  const d = copy();
  const item = d.deliveryPlan.items[0];
  item.complete = true;
  d.deliveryPlan.checkedCoreTodos = 1;
  item.gateResults = Object.fromEntries(item.requirements.map((_, i) => [String(i + 1), 'passed']));
  item.evidence = ['not a receipt'];
  assert(validate(d).some((x) => x.includes('Incomplete Finf acceptance')));
});
test('checklist summary follows verified completion count instead of hardcoded zero', () => {
  const d = copy();
  d.deliveryPlan.checkedCoreTodos = 1;
  assert(render(d).includes('1 core items are checked complete'));
});

test('completion cannot weaken or empty the fixed seven acceptance dimensions', () => {
  for (const requirements of [[], baseline.deliveryPlan.items[0].requirements.slice(0, 6)]) {
    const d = copy();
    const item = d.deliveryPlan.items[0];
    item.requirements = requirements;
    item.gateResults = Object.fromEntries(requirements.map((_, i) => [String(i + 1), 'passed']));
    assert(validate(d).some((x) => x.includes('required dimensions drift')));
  }
});

test('all selected core items are required even when total count is unchanged', () => {
  const d = copy();
  d.deliveryPlan.items[d.deliveryPlan.items.length - 1] = structuredClone(d.deliveryPlan.items[0]);
  assert(validate(d).some((x) => x.includes('required item scope drift')));
});
test('prior PR work cannot be checked without exact accepted closeout receipts', () => {
  const d = copy();
  d.deliveryPlan.priorWork[0].complete = true;
  assert(validate(d).some((x) => x.includes('Incomplete prior work closeout')));
});
test('source definitions cannot be removed from a cataloged family inventory', () => {
  const d = copy();
  d.prototypeInventory.base.button.sourceFiles = [];
  assert(
    validate(d).some(
      (x) => x.includes('source count drift') || x.includes('source identity set drift')
    )
  );
});
function acceptedItemShape(data, id) {
  const item = data.deliveryPlan.items.find((x) => x.id === id);
  item.complete = true;
  data.deliveryPlan.checkedCoreTodos = 1;
  item.acceptedRevision = 'a'.repeat(40);
  item.gateResults = Object.fromEntries(item.requirements.map((_, i) => [String(i + 1), 'passed']));
  item.evidence = item.requirements.map((_, i) => ({
    gate: String(i + 1),
    result: 'passed',
    revision: item.acceptedRevision,
    source: 'https://example.invalid/unit-fixture',
    kind: 'unit-fixture',
  }));
  item.independentReview = {
    revision: item.acceptedRevision,
    verdict: 'approved',
    reviewer: 'unit-fixture',
    source: 'https://example.invalid/unit-fixture',
  };
  return item;
}
test('complete parity still fails with missing or unevidenced four-family atomic cells', () => {
  const d = copy();
  acceptedItemShape(d, 'baseline.async-region');
  assert(validate(d).some((x) => x.includes('Incomplete Finf projection acceptance')));
  const e = copy();
  const item = acceptedItemShape(e, 'baseline.button');
  assert(validate(e).some((x) => x.includes('Incomplete Finf projection acceptance')));
  const row = e.atomicProjectionMapping.find((x) => x.baseIdentity === 'P-BASE-BUTTON');
  for (const cell of Object.values(row.projectionCells)) {
    cell.acceptance = 'passed';
    cell.evidence = cell.mappedCurrentIdentities.map((id) => ({
      projectionIdentity: id,
      result: 'passed',
      revision: item.acceptedRevision,
      source: 'https://example.invalid/unit-fixture',
    }));
  }
  assert.deepEqual(validate(e), []); // Shape-only unit positive; never a real acceptance receipt.
  row.projectionCells['liquid-glass'].evidence = [];
  assert(validate(e).some((x) => x.includes('Incomplete Finf projection acceptance')));
});
test('Overlay-specific acceptance dimensions remain in the reader execution entry', () => {
  const item = baseline.deliveryPlan.items.find(
    (x) => x.id === 'repair.overlay-scrollbar-coordinate'
  );
  for (const requirement of item.requirements.slice(7))
    assert(renderPlan(baseline).includes(requirement));
});
test('reference denominator, counterpart and intersection summaries derive from data', () => {
  const d = copy();
  d.referenceSnapshots.shadcn.directoryCount = 65;
  d.referenceSnapshots.baseUi.directoryCount = 38;
  d.referenceSnapshots.baseUi.docsVersion = 'test-version';
  d.counts.shadcnNamedProjections = 16;
  d.counts.baseUiMainCounterparts = 15;
  d.counts.baseUiNoMainCounterpart = 23;
  d.counts.comparisonIntersection = 31;
  d.counts.comparisonUnion = 72;
  const text = render(d);
  for (const expected of [
    '65 directory subjects',
    '38 component families',
    '16 named Shadcn projections',
    '15 bounded Base counterparts',
    'Intersection 31; union 72',
    'docs test-version',
  ])
    assert(text.includes(expected));
});
test('source consumer state and owner cannot drift behind internally consistent copied totals', () => {
  const d = copy();
  const row = d.consumerRows.find((x) => x.program === 'website');
  row.State = 'research';
  d.counts.consumerPrograms.website.states = {};
  for (const r of d.consumerRows.filter((x) => x.program === 'website'))
    d.counts.consumerPrograms.website.states[r.State] =
      (d.counts.consumerPrograms.website.states[r.State] ?? 0) + 1;
  assert(
    validate(d).some((x) => x.includes('Consumer source field drift') && x.includes('.State'))
  );
  const e = copy();
  e.consumerRows[0]['Current owner'] = 'different source owner';
  assert(
    validate(e).some(
      (x) => x.includes('Consumer source field drift') && x.includes('Current owner')
    )
  );
});
