import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stringify as stringifyYaml } from 'yaml';
import {
  root,
  dataPath,
  markdownPath,
  validate as validateActual,
  render,
  renderPlan,
  inheritedPrototypeIds,
  refreshCandidateSource,
  captureGitObjectProof,
} from '../prototype-coverage.mjs';
const baseline = JSON.parse(fs.readFileSync(path.join(root, dataPath), 'utf8'));
// Retain the real pinned-main native proof so receipt tests work in depth-1 CI.
const mainGpuiSource = JSON.parse(
  fs.readFileSync(new URL('./fixtures/gpui-main-source-proof.json', import.meta.url), 'utf8')
);
assert.equal(mainGpuiSource.revision, baseline.protoMain);
const fixtureCopies = new WeakSet();
let fixtureTransforms = {};
const fixturePaths = new Set(baseline.mainSourceEvidence.sourceBindings.map((entry) => entry.path));
const fixtureSource = {
  existsSync(file) {
    const p = path.relative(root, file).split(path.sep).join('/');
    return fixturePaths.has(p) || [...fixturePaths].some((x) => x.startsWith(p + '/'));
  },
  readFileSync(file, encoding) {
    const p = path.relative(root, file).split(path.sep).join('/');
    const text = baseline.mainSourceEvidence.catalog[p]
      ? stringifyYaml(baseline.mainSourceEvidence.catalog[p])
      : baseline.mainSourceEvidence.manifests[p]
        ? JSON.stringify(baseline.mainSourceEvidence.manifests[p])
        : fs.readFileSync(file, 'utf8');
    const result = fixtureTransforms[p] ? fixtureTransforms[p](text) : text;
    return encoding ? result : Buffer.from(result);
  },
  readdirSync(directory, options = {}) {
    const prefix = path.relative(root, directory).split(path.sep).join('/') + '/';
    const entries = new Map();
    for (const p of fixturePaths) {
      if (!p.startsWith(prefix)) continue;
      const [first, ...rest] = p.slice(prefix.length).split('/');
      entries.set(first, rest.length > 0);
    }
    return [...entries].map(([name, directory]) =>
      options.withFileTypes
        ? { name, isDirectory: () => directory, isFile: () => !directory }
        : name
    );
  },
};
// Mutation cases exercise a fixed historical fixture; the production source test
// and all candidate tests below still use the real current source and hashes.
const copy = () => {
  const d = structuredClone(baseline);
  delete d.candidateSource;
  fixtureCopies.add(d);
  return d;
};
const validate = (data, repoRoot = root) =>
  validateActual(
    data,
    repoRoot,
    false,
    fixtureCopies.has(data) && !data.candidateSource ? fixtureSource : fs
  );
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
  item.acceptedRevision = data.protoMain;
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
  assert(validate(e).some((x) => x.includes('Incomplete GPUI acceptance')));
  for (const gpui of e.gpuiCoverageRows.filter((x) => x.baseIdentity === 'P-BASE-BUTTON')) {
    gpui.status = 'verified';
    fillGpuiImplementation(gpui, item.acceptedRevision);
    gpui.nativeEvidence = [
      {
        result: 'passed',
        revision: item.acceptedRevision,
        source: 'https://example.invalid/unit-fixture',
      },
    ];
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

test('safe-area and GPUI dimensions and complete GPUI atomic rows cannot be omitted', () => {
  const d = copy();
  d.gpuiCoverageRows.pop();
  assert(validate(d).some((x) => x.includes('Required GPUI atomic/family set drift')));
  const e = copy();
  e.deliveryPlan.gpuiParity.required = false;
  assert(validate(e).some((x) => x.includes('GPUI same-capability scope')));
  const f = copy();
  f.deliveryPlan.items[0].requirements.splice(7, 2);
  assert(validate(f).some((x) => x.includes('required dimensions drift')));
});

// PR #872 review regressions. All invented receipts below are unit fixtures only.
test('review 4198701628: all thirteen retained PRs survive editable count changes', () => {
  assert.deepEqual(validate(copy()), []);
  for (const pr of baseline.deliveryPlan.priorWork.map((x) => x.pr)) {
    const d = copy();
    d.deliveryPlan.priorWork = d.deliveryPlan.priorWork.filter((x) => x.pr !== pr);
    d.deliveryPlan.priorWorkRoutingCount--;
    d.deliveryPlan.initialTodoCount--;
    assert(
      validate(d).some((x) => x.includes('required prior work set')),
      `dropped #${pr}`
    );
  }
});

test('review 4198701640: comparison Base and styled mappings match their source family', () => {
  assert.deepEqual(validate(copy()), []);
  for (const mutate of [
    (r) => {
      r.base.family = 'dialog';
    },
    (r) => {
      r.base.entityIds = ['P-BASE-INVENTED'];
    },
    (r) => {
      r.base.sourceFiles = ['packages/prototypes/base/src/missing.proto.ts'];
    },
    (r) => {
      r.base.tests = [];
    },
    (r) => {
      r.base.lifecycle = 'active';
    },
    (r) => {
      r.lifecycle = 'active';
    },
    (r) => {
      r.base = structuredClone(baseline.prototypeInventory.base.dialog);
    },
    (r) => {
      r.projections.shadcn.entityIds = ['P-SHADCN-DIALOG'];
    },
  ]) {
    const d = copy();
    mutate(d.comparisonRows.find((x) => x.slug === 'button'));
    assert(
      validate(d).some((x) => x.includes('Comparison')),
      String(mutate)
    );
  }
});

test('review 4198701648: projection cells cannot invent state, counts or anatomy', () => {
  assert.deepEqual(validate(copy()), []);
  for (const [family, mutate] of [
    [
      'button',
      (c) => {
        c.partCount = 42;
      },
    ],
    [
      'button',
      (c) => {
        c.status = 'complete';
      },
    ],
    [
      'button',
      (c) => {
        c.entityIds = ['P-SHADCN-DIALOG'];
      },
    ],
    [
      'button',
      (c) => {
        c.sourceFiles = [];
      },
    ],
    [
      'button',
      (c) => {
        c.lifecycle = 'active';
      },
    ],
    [
      'async-region',
      (c) => {
        c.status = 'implemented-draft';
      },
    ],
  ]) {
    const d = copy();
    mutate(d.projectionRows.find((x) => x.base.family === family).families.shadcn);
    assert(
      validate(d).some((x) => x.includes('Projection cell')),
      String(mutate)
    );
  }
});

function recountComparisons(d) {
  const rows = d.comparisonRows;
  const sh = rows.filter((r) => r.referenceProjects.some((s) => s.project === 'shadcn/ui'));
  const ba = rows.filter((r) => r.referenceProjects.some((s) => s.project === 'Base UI'));
  const counts = (rs) =>
    Object.fromEntries(
      [...new Set(rs.map((r) => r.classification))].map((c) => [
        c,
        rs.filter((r) => r.classification === c).length,
      ])
    );
  d.referenceSnapshots.shadcn.directoryCount = sh.length;
  d.referenceSnapshots.baseUi.directoryCount = ba.length;
  d.counts.comparisonUnion = rows.length;
  d.counts.comparisonIntersection = sh.filter((r) => ba.includes(r)).length;
  d.counts.baseUiMainCounterparts = ba.filter((r) => r.base).length;
  d.counts.baseUiNoMainCounterpart = ba.filter((r) => !r.base).length;
  d.counts.shadcnNamedProjections = sh.filter((r) => r.projections.shadcn.entityIds.length).length;
  d.counts.comparisonClassCounts = counts(rows);
  d.counts.shadcnDifferenceClassCounts = counts(
    sh.filter((r) => !r.projections.shadcn.entityIds.length)
  );
}
test('review 4198701658: subject, alias and pinned URL duplication cannot inflate totals', () => {
  assert.deepEqual(validate(copy()), []);
  for (const mode of ['slug', 'alias', 'url', 'pinnedSource']) {
    const d = copy();
    const row = structuredClone(d.comparisonRows.find((x) => x.slug === 'dropdown-menu'));
    row.id = 'compare.invented-distinct-id';
    if (mode !== 'slug') row.slug = mode === 'alias' ? 'menu' : 'unrelated';
    for (const reference of row.referenceProjects) {
      if (mode !== 'url') reference.url += '-different';
      if (mode !== 'pinnedSource') reference.pinnedSource += '-different';
    }
    d.comparisonRows.push(row);
    recountComparisons(d);
    assert(
      validate(d).some((x) => /Duplicate comparison (subject|reference)/.test(x)),
      mode
    );
  }
});

test('review 4198701671: consumer program and exact ledger are closed sets', () => {
  assert.deepEqual(validate(copy()), []);
  for (const mode of ['unknown-program', 'invented-config', 'wrong-ledger', 'missing-program']) {
    const d = copy();
    if (mode === 'missing-program') {
      d.consumerRows = d.consumerRows.filter((r) => r.program !== 'harness');
      delete d.counts.consumerPrograms.harness;
      for (const r of d.comparisonRows)
        r.consumerRows = r.consumerRows.filter((id) => !id.startsWith('harness.'));
    } else if (mode === 'wrong-ledger') {
      d.consumerRows.find((r) => r.program === 'website').source =
        'internal/agent-harness/dogfood-coverage-matrix.md';
    } else {
      const row = { ...d.consumerRows[0], ID: 'invented.consumer', program: 'invented' };
      d.consumerRows.push(row);
      d.comparisonRows[0].consumerRows.push(row.ID);
      if (mode === 'invented-config')
        d.counts.consumerPrograms.invented = { rows: 1, states: { [row.State]: 1 } };
    }
    assert(
      validate(d).some((x) => /Consumer (program|ledger)/.test(x)),
      mode
    );
  }
});

function mockRead(t, transforms) {
  fixtureTransforms = transforms;
  t.after(() => {
    fixtureTransforms = {};
  });
  const read = fs.readFileSync.bind(fs);
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    const original = read(file, ...args);
    const relative = path.relative(root, String(file)).split(path.sep).join('/');
    return transforms[relative] ? transforms[relative](original) : original;
  });
}
function refreshButtonLifecycle(d, status) {
  d.prototypeInventory.base.button.lifecycle = status;
  const row = d.comparisonRows.find((r) => r.slug === 'button');
  row.base.lifecycle = status;
  row.lifecycle = status;
  d.projectionRows.find((r) => r.base.family === 'button').base.lifecycle = status;
  d.counts.catalogDraft--;
  const key = 'catalog' + status[0].toUpperCase() + status.slice(1);
  d.counts[key] = (d.counts[key] ?? 0) + 1;
}
for (const status of ['active', 'deprecated', 'removed']) {
  test(`review 4198701681: refreshed ${status} lifecycle follows catalog, not eternal draft`, (t) => {
    mockRead(t, {
      'spec/prototypes/P-BASE-BUTTON.yaml': (text) =>
        text.replace('status: draft', `status: ${status}`),
    });
    const d = copy();
    assert(validate(d).some((x) => /Lifecycle|lifecycle/.test(x)));
    refreshButtonLifecycle(d, status);
    assert.deepEqual(validate(d), []);
    assert(
      render(d).includes(
        `${d.counts['catalog' + status[0].toUpperCase() + status.slice(1)]} ${status}`
      )
    );
  });
}

test('review 4198701688: package snapshot detects drift and renders a refreshed manifest', (t) => {
  const d = copy();
  const manifestPath = 'packages/prototypes/bootstrap-2-3-2/package.json';
  const changed = {
    ...JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8')),
    private: false,
    version: '9.8.7',
    exports: { '.': { types: './dist/main.d.ts', import: './dist/main.js' } },
  };
  mockRead(t, { [manifestPath]: () => JSON.stringify(changed) });
  assert(validate(d).some((x) => x.includes('Package consumption snapshot drift')));
  Object.assign(d.packageConsumption['bootstrap-2-3-2'], {
    private: false,
    version: changed.version,
    rootExport: changed.exports['.'],
  });
  assert.deepEqual(validate(d), []);
  const rendered = render(d);
  assert(rendered.includes('9.8.7'));
  assert(rendered.includes('./dist/main.js'));
  assert(!rendered.includes('Bootstrap 2.3.2 and Liquid Glass currently declare private: true'));
});

function closeoutShape(item) {
  item.complete = true;
  item.closeout = {
    mode: 'accepted-in-Finf',
    sourcePullRequest: item.pr,
    sourceHead: 'b'.repeat(40),
    integrationRevision: 'c'.repeat(40),
    evidence: 'https://example.invalid/closeout-fixture',
    ci: 'passed',
    independentReview: {
      verdict: 'approved',
      revision: 'c'.repeat(40),
      source: 'https://example.invalid/review-fixture',
    },
  };
}
test('review 4198701695: retained criteria render accepted closeout instead of unmet', () => {
  const d = copy();
  const item = d.deliveryPlan.priorWork.find((x) => x.pr === 775);
  for (const c of item.mandatoryUnfinishedCriteria)
    assert(renderPlan(d).includes(`**${c.id}** (unmet)`));
  closeoutShape(item);
  assert.deepEqual(validate(d), []);
  const rendered = renderPlan(d);
  for (const c of item.mandatoryUnfinishedCriteria) {
    assert(!rendered.includes(`**${c.id}** (unmet)`));
    assert(rendered.includes(`**${c.id}** (accepted closeout)`));
  }
  assert(rendered.includes(item.closeout.sourceHead));
  assert(rendered.includes(item.closeout.integrationRevision));
  assert(rendered.includes(item.closeout.evidence));
});

function fillGpuiImplementation(row, revision) {
  row.blockers = [];
  row.implementationEvidence = row.projectionIdentities.map((projectionIdentity) => ({
    baseIdentity: row.baseIdentity,
    projectionIdentity,
    revision,
    result: 'passed',
    source: 'https://example.invalid/shape-only-implementation-receipt',
    paths: ['packages/adapters/gpui-peer/src/session.ts'],
    sourceObjectProof:
      revision === mainGpuiSource.revision
        ? structuredClone(mainGpuiSource.sourceObjectProof)
        : captureGitObjectProof(root, revision, ['packages/adapters/gpui-peer/src/session.ts']),
  }));
}

function acceptAtomicScope(d, item, ids) {
  item.baseEntityIds = ids;
  for (const id of ids) {
    const row = d.atomicProjectionMapping.find((x) => x.baseIdentity === id);
    for (const cell of Object.values(row.projectionCells)) {
      cell.acceptance = 'passed';
      cell.evidence = cell.mappedCurrentIdentities.map((projectionIdentity) => ({
        projectionIdentity,
        result: 'passed',
        revision: item.acceptedRevision,
        source: 'https://example.invalid/atomic-fixture',
      }));
    }
    for (const row of d.gpuiCoverageRows.filter((x) => x.baseIdentity === id)) {
      row.status = 'verified';
      fillGpuiImplementation(row, item.acceptedRevision);
      row.nativeEvidence = [
        {
          result: 'passed',
          revision: item.acceptedRevision,
          source: 'https://example.invalid/gpui-fixture',
        },
      ];
    }
  }
}
test('review 4198901128: Button receipts cannot complete Label or Overlay', () => {
  const positive = copy();
  acceptAtomicScope(positive, acceptedItemShape(positive, 'baseline.button'), ['P-BASE-BUTTON']);
  assert.deepEqual(validate(positive), []);
  for (const id of ['deliver.label', 'repair.overlay-scrollbar-coordinate']) {
    const d = copy();
    acceptAtomicScope(d, acceptedItemShape(d, id), ['P-BASE-BUTTON']);
    assert(
      validate(d).some((x) => x.includes('Finf subject Base scope')),
      id
    );
  }
  const renamed = copy();
  const item = acceptedItemShape(renamed, 'deliver.label');
  item.name = 'button';
  item.kind = 'complete-current-Base-four-projections';
  acceptAtomicScope(renamed, item, ['P-BASE-BUTTON']);
  assert(validate(renamed).some((x) => x.includes('Finf subject Base scope')));
});

function sameSourceCandidate() {
  const d = copy();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root }).toString().trim();
  d.candidateSource = refreshCandidateSource(d, root, { tree });
  return d;
}
test('candidate refresh preserves pinned-main comparison and all acceptance checkboxes', () => {
  const d = sameSourceCandidate();
  assert.deepEqual(d.comparisonRows, baseline.comparisonRows);
  assert.deepEqual(d.counts, baseline.counts);
  assert.deepEqual(d.deliveryPlan, baseline.deliveryPlan);
  assert.equal(
    d.candidateSource.gpuiCoverageRows.length,
    d.candidateSource.counts.libraryInventory.base.entities * 4
  );
  assert.deepEqual(validate(d), []);
  const text = render(d);
  assert(text.includes('Separate candidate source inventory'));
  assert(text.includes('candidate-only'));
  assert(text.includes(d.candidateSource.tree));
});
test('candidate source is independently checked without weakening the pinned main', () => {
  const d = sameSourceCandidate();
  d.candidateSource.prototypeInventory.base.button.sourceFiles = [];
  assert(validate(d).some((x) => x.startsWith('Candidate:') && x.includes('source')));
  const e = sameSourceCandidate();
  e.comparisonRows.find((r) => r.slug === 'button').base.entityIds = ['P-BASE-INVENTED'];
  assert(validate(e).some((x) => x.includes('Comparison Base inventory mismatch')));
});
test('candidate source rejects invented revisions, wrong source bytes and changed comparison counts', (t) => {
  const d = sameSourceCandidate();
  d.candidateSource.tree = 'a'.repeat(40);
  assert(validate(d).some((x) => x.includes('Candidate source binding revision drift')));
  const e = sameSourceCandidate();
  e.candidateSource.counts.comparisonUnion = 999;
  assert(validate(e).some((x) => x.includes('Candidate inventory count scope drift')));
  const f = sameSourceCandidate();
  mockRead(t, {
    'packages/prototypes/base/src/button/button.proto.ts': (text) =>
      text + '\n// unit-fixture changed bytes\n',
  });
  assert(validate(f).some((x) => x.includes('Candidate source binding/worktree drift')));
});
test('candidate source cannot relabel the top-level main snapshot', () => {
  const d = copy();
  d.sourceSnapshot = { kind: 'candidate', revision: 'a'.repeat(40), baseMain: d.protoMain };
  assert(validate(d).some((x) => x.includes('Source snapshot revision boundary drift')));
});
test('projection lifecycle and atomic state advance together with the catalog', (t) => {
  const d = copy();
  mockRead(t, {
    'spec/prototypes/P-SHADCN-BUTTON.yaml': (text) =>
      text.replace('status: draft', 'status: active'),
  });
  assert(validate(d).some((x) => /lifecycle/.test(x)));
  d.prototypeInventory.shadcn.button.lifecycle = 'active';
  d.counts.catalogDraft--;
  d.counts.catalogActive++;
  d.comparisonRows.find((r) => r.slug === 'button').projections.shadcn.status =
    'implemented-active';
  const cell = d.projectionRows.find((r) => r.base.family === 'button').families.shadcn;
  cell.lifecycle = 'active';
  cell.status = 'implemented-active';
  d.atomicProjectionMapping.find(
    (r) => r.baseIdentity === 'P-BASE-BUTTON'
  ).projectionCells.shadcn.status = 'bounded-active-mapping-needs-full-acceptance';
  assert.deepEqual(validate(d), []);
});
test('mixed lifecycle families are counted from each actual catalog identity', (t) => {
  const d = copy();
  mockRead(t, {
    'spec/prototypes/P-BASE-DIALOG-TRIGGER.yaml': (text) =>
      text.replace('status: draft', 'status: active'),
  });
  assert(validate(d).some((x) => /lifecycle/.test(x)));
  d.prototypeInventory.base.dialog.lifecycle = 'mixed';
  d.counts.catalogDraft--;
  d.counts.catalogActive++;
  const row = d.comparisonRows.find((r) => r.slug === 'dialog');
  row.lifecycle = 'mixed';
  row.base.lifecycle = 'mixed';
  d.projectionRows.find((r) => r.base.family === 'dialog').base.lifecycle = 'mixed';
  assert.deepEqual(validate(d), []);
});

test('shallow/offline validation needs neither historical main nor candidate Git objects', (t) => {
  const d = sameSourceCandidate();
  const oldPath = process.env.PATH;
  process.env.PATH = '';
  t.after(() => {
    process.env.PATH = oldPath;
  });
  // Distinct lexical root also avoids a prior process-local Git snapshot cache.
  assert.deepEqual(validate(d, root + '/.'), []);
  const changed = structuredClone(d);
  changed.mainSourceEvidence.catalog['spec/prototypes/P-BASE-BUTTON.yaml'].status = 'active';
  assert(validate(changed, root + '/.').some((x) => x.includes('Historical main evidence digest')));
  const missing = structuredClone(d);
  missing.candidateSource.sourceBindings.pop();
  assert(
    validate(missing, root + '/.').some((x) =>
      x.includes('Candidate source binding path set drift')
    )
  );
});
test('main evidence and candidate hash snapshots cannot substitute for each other', () => {
  const d = sameSourceCandidate();
  d.candidateSource.sourceBindings[0].sha256 = '0'.repeat(64);
  assert(validate(d).some((x) => x.includes('Candidate source binding/worktree drift')));
  const e = sameSourceCandidate();
  e.mainSourceEvidence.revision = e.candidateSource.tree;
  assert(validate(e).some((x) => x.includes('Historical main evidence digest/revision mismatch')));
});

test('review 4199624952: changing both advertised object fields cannot reuse worktree bindings', () => {
  const d = sameSourceCandidate();
  d.candidateSource.tree = d.protoMain;
  d.candidateSource.sourceBindingsObject = d.protoMain;
  assert(validate(d).some((x) => /advertised Git object|Git object proof/.test(x)));
});
test('review 4199624959: native receipt cannot override GPUI implementation blockers', () => {
  const d = copy();
  acceptAtomicScope(d, acceptedItemShape(d, 'baseline.button'), ['P-BASE-BUTTON']);
  d.gpuiCoverageRows.find((r) => r.baseIdentity === 'P-BASE-BUTTON').blockers = [
    'Native host not implemented',
  ];
  assert(validate(d).some((x) => /GPUI implementation/.test(x)));
});
test('review 4199624959: an empty implementation ledger cannot verify GPUI', () => {
  const d = copy();
  acceptAtomicScope(d, acceptedItemShape(d, 'baseline.button'), ['P-BASE-BUTTON']);
  const row = d.gpuiCoverageRows.find((r) => r.baseIdentity === 'P-BASE-BUTTON');
  row.blockers = [];
  row.implementationEvidence = [];
  assert(validate(d).some((x) => /GPUI implementation/.test(x)));
});

test('advertised commit proof rejects a real but different commit even with both fields changed', () => {
  const d = copy();
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  d.candidateSource = refreshCandidateSource(d, root, { revision });
  assert.deepEqual(validate(d), []);
  d.candidateSource.revision = d.protoMain;
  d.candidateSource.sourceBindingsObject = d.protoMain;
  assert(validate(d).some((x) => /Git object proof.*advertised Git object/.test(x)));
});
test('offline Git proofs reject changed tree bytes and a missing Merkle branch', () => {
  const d = sameSourceCandidate();
  const tree = d.candidateSource.sourceObjectProof.trees[0];
  const bytes = Buffer.from(tree.contentBase64, 'base64');
  bytes[bytes.length - 1] ^= 1;
  tree.contentBase64 = bytes.toString('base64');
  assert(validate(d).some((x) => /Git object proof tree hash/.test(x)));
  const e = sameSourceCandidate();
  e.candidateSource.sourceObjectProof.trees.shift();
  assert(validate(e).some((x) => /Git object proof path missing/.test(x)));
});
test('GPUI implementation records must identify this projection and real native source at acceptance revision', () => {
  for (const mutate of [
    (e) => {
      e.revision = 'b'.repeat(40);
    },
    (e) => {
      e.projectionIdentity = 'P-BASE-LABEL';
    },
    (e) => {
      e.paths = ['native/gpui/crates/nonexistent/src/pretend.rs'];
    },
    (e) => {
      e.paths = ['packages/prototypes/base/src/button/button.proto.ts'];
    },
    (e) => {
      e.paths = ['native/gpui/../../../package.json'];
    },
  ]) {
    const d = copy();
    acceptAtomicScope(d, acceptedItemShape(d, 'baseline.button'), ['P-BASE-BUTTON']);
    const row = d.gpuiCoverageRows.find((r) => r.baseIdentity === 'P-BASE-BUTTON');
    mutate(row.implementationEvidence[0]);
    assert(validate(d).some((x) => /GPUI implementation/.test(x)));
  }
});

// These are receipt-shape controls using real source-object proofs, not native
// execution or acceptance claims. No fixture is persisted into the portfolio.
function verifiedGpuiShape(kind) {
  const d = structuredClone(baseline);
  if (kind !== 'main') {
    const identity = kind === 'candidate-tree' ? 'tree' : 'revision';
    const object = execFileSync(
      'git',
      ['rev-parse', identity === 'tree' ? 'HEAD^{tree}' : 'HEAD'],
      {
        cwd: root,
      }
    )
      .toString()
      .trim();
    d.candidateSource = refreshCandidateSource(d, root, { [identity]: object });
  }
  const source = kind === 'main' ? d : d.candidateSource;
  const revision = kind === 'main' ? d.protoMain : (source.revision ?? source.tree);
  const row = source.gpuiCoverageRows.find((r) => r.projectionIdentities.length > 0);
  row.status = 'verified';
  fillGpuiImplementation(row, revision);
  row.nativeEvidence = [
    { result: 'passed', revision, source: 'https://example.invalid/native-shape-only' },
  ];
  return { data: d, row, revision };
}

for (const kind of ['main', 'candidate-commit', 'candidate-tree']) {
  test(`review 4217415370: ${kind} verified GPUI accepts matching source-bound receipt shapes`, () => {
    const { data } = verifiedGpuiShape(kind);
    assert.deepEqual(validateActual(data), []);
    assert.equal(data.deliveryPlan.checkedCoreTodos, 0);
  });
  for (const [name, mutate, diagnostic] of [
    [
      'stale implementation revision',
      (r) => {
        r.implementationEvidence[0].revision = 'a'.repeat(40);
      },
      /GPUI implementation/,
    ],
    [
      'missing native evidence',
      (r) => {
        delete r.nativeEvidence;
      },
      /GPUI acceptance/,
    ],
    [
      'empty native evidence',
      (r) => {
        r.nativeEvidence = [];
      },
      /GPUI acceptance/,
    ],
    [
      'stale native revision',
      (r) => {
        r.nativeEvidence[0].revision = 'a'.repeat(40);
      },
      /GPUI acceptance/,
    ],
    [
      'failed native result',
      (r) => {
        r.nativeEvidence[0].result = 'failed';
      },
      /GPUI acceptance/,
    ],
    [
      'missing native source',
      (r) => {
        delete r.nativeEvidence[0].source;
      },
      /GPUI acceptance/,
    ],
    [
      'malformed native evidence',
      (r) => {
        r.nativeEvidence = [null];
      },
      /GPUI acceptance/,
    ],
    [
      'wrong source proof object',
      (r) => {
        r.implementationEvidence[0].sourceObjectProof.rootTree = 'b'.repeat(40);
      },
      /GPUI implementation/,
    ],
    [
      'missing native source proof',
      (r) => {
        delete r.implementationEvidence[0].sourceObjectProof;
      },
      /GPUI implementation/,
    ],
    [
      'tampered native source proof',
      (r) => {
        r.implementationEvidence[0].sourceObjectProof.trees[0].contentBase64 =
          Buffer.from('forged').toString('base64');
      },
      /GPUI implementation/,
    ],
    [
      'unproven native source path',
      (r) => {
        r.implementationEvidence[0].paths = ['native/gpui/crates/proto-ui-gpui/src/host.rs'];
      },
      /GPUI implementation/,
    ],
  ]) {
    test(`review 4217415370: ${kind} verified GPUI rejects ${name}`, () => {
      const { data, row } = verifiedGpuiShape(kind);
      mutate(row);
      assert(validateActual(data).some((error) => diagnostic.test(error)));
    });
  }
  test(`review 4217415370: ${kind} verified GPUI proof validates offline without Git`, (t) => {
    const { data } = verifiedGpuiShape(kind);
    const previous = process.env.PATH;
    process.env.PATH = '';
    t.after(() => {
      process.env.PATH = previous;
    });
    assert.deepEqual(validateActual(data, root + '/.'), []);
  });
}

test('review 4217415370: candidate verified GPUI rejects changed native worktree bytes', (t) => {
  const { data } = verifiedGpuiShape('candidate-commit');
  mockRead(t, {
    'packages/adapters/gpui-peer/src/session.ts': (text) => text + '\n// changed native source\n',
  });
  assert(validateActual(data).some((error) => /GPUI implementation/.test(error)));
});

test('review 4217415370: historical main proof does not read current native source', (t) => {
  const { data } = verifiedGpuiShape('main');
  mockRead(t, {
    'packages/adapters/gpui-peer/src/session.ts': () => {
      assert.fail('Historical main receipt must use its own proven source object');
    },
  });
  assert.deepEqual(validateActual(data), []);
});

for (const kind of ['missing-file', 'symlinked-parent']) {
  test(`review 4217415370: candidate verified GPUI rejects ${kind}`, (t) => {
    const { data } = verifiedGpuiShape('candidate-commit');
    const lstat = fs.lstatSync.bind(fs);
    t.mock.method(fs, 'lstatSync', (file, ...args) => {
      const relative = path.relative(root, String(file)).split(path.sep).join('/');
      if (kind === 'missing-file' && relative === 'packages/adapters/gpui-peer/src/session.ts')
        throw new Error('Source file unavailable');
      if (kind === 'symlinked-parent' && relative === 'packages/adapters/gpui-peer/src')
        return { isSymbolicLink: () => true };
      return lstat(file, ...args);
    });
    assert(validateActual(data).some((error) => /GPUI implementation/.test(error)));
  });
}

test('candidate refresh does not erase known unresolved GPUI blockers', () => {
  const d = sameSourceCandidate();
  const row = d.candidateSource.gpuiCoverageRows[0];
  row.blockers = ['Actual native source scope remains unimplemented'];
  const refreshed = refreshCandidateSource(d, root, { tree: d.candidateSource.tree });
  const retained = refreshed.gpuiCoverageRows.find(
    (r) => r.baseIdentity === row.baseIdentity && r.projectionLibrary === row.projectionLibrary
  );
  assert.deepEqual(retained.blockers, row.blockers);
  assert.equal(retained.status, 'required-unassessed');
});

for (const project of ['shadcn/ui', 'Base UI']) {
  for (const [name, mutate] of [
    [
      'another revision',
      (u) => {
        u.pathname = u.pathname.replace(
          /\/(blob|tree)\/[a-f0-9]{40}\//,
          '/$1/' + '1'.repeat(40) + '/'
        );
      },
    ],
    [
      'another repository',
      (u) => {
        u.pathname = u.pathname.replace(/^\/[^/]+\/[^/]+\//, '/unreviewed/repository/');
      },
    ],
    [
      'another host',
      (u) => {
        u.hostname = 'example.com';
      },
    ],
    [
      'non-HTTPS transport',
      (u) => {
        u.protocol = 'http:';
      },
    ],
    [
      'query override',
      (u) => {
        u.search = '?ref=unreviewed';
      },
    ],
    [
      'fragment alias',
      (u) => {
        u.hash = '#unreviewed';
      },
    ],
  ]) {
    test(`${project} pins reject ${name} even when the URL is unique`, () => {
      const data = copy();
      const reference = data.comparisonRows
        .flatMap((row) => row.referenceProjects)
        .find((r) => r.project === project);
      const url = new URL(reference.pinnedSource);
      mutate(url);
      reference.pinnedSource = url.href;
      assert(validate(data).some((error) => error.includes('Reference snapshot pin mismatch')));
    });
  }
  test(`${project} pins reject a malformed URL without throwing`, () => {
    const data = copy();
    data.comparisonRows
      .flatMap((row) => row.referenceProjects)
      .find((r) => r.project === project).pinnedSource = 'not-a-url';
    assert(validate(data).some((error) => error.includes('Reference snapshot pin mismatch')));
  });
}
