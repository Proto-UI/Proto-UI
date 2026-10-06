import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

export const FINF_REQUIRED_DIMENSIONS = Object.freeze([
  'Complete governed semantic contract and explicit negative boundaries; no simplified interim version marked done',
  'Final Base identities mapped atom-by-atom to Shadcn, Neobrutalism (package brutalist), Bootstrap 2.3.2 and Liquid Glass',
  'Every applicable Module/Host Capability/Adapter profile and generated Compiler target has verified conformance; unsupported/omitted scope explicitly governed, never counted as a pass',
  'Complete source/dist exports, build and type artifacts, install/consumer smoke from local packed artifacts, package/CLI surface, DemoSpec, reachable real demos and bilingual documentation. Registry publication is a separate explicitly authorized release action.',
  'Controlled/uncontrolled, disabled/readOnly, keyboard/pointer/touch/IME where applicable, accessibility, repeated mount/unmount and interruption paths',
  'Real-input runtime and commit-bound visual evidence for all affected compositions/overlay dependants and four design languages',
  'Focused and applicable aggregate tests plus trusted exact-head CI/DCO and independent review; no outstanding applicable findings',
]);
const OVERLAY_REQUIRED_DIMENSIONS = Object.freeze([
  'Reproduce the actual user-reported scroll/scrollbar coordinate drift before assigning root cause',
  'Exercise body and nested scrollers, portal/container coordinates, scrollbar appearance/removal, modal scroll lock, RTL, zoom/transforms and resize; verify every anchored/dependent overlay',
  'Preserve original reproduction, failing baseline and repaired exact-head evidence',
]);
const FINF_CORE_ITEM_IDS = Object.freeze([
  'deliver.label',
  'deliver.field',
  'deliver.fieldset',
  'deliver.form',
  'deliver.checkbox-group',
  'deliver.autocomplete',
  'deliver.combobox',
  'deliver.command',
  'deliver.toggle-group',
  'deliver.toolbar',
  'deliver.menubar',
  'deliver.navigation-menu',
  'deliver.context-menu',
  'deliver.collapsible',
  'deliver.accordion',
  'deliver.popover',
  'deliver.alert-dialog',
  'deliver.drawer',
  'deliver.toast',
  'deliver.slider',
  'deliver.number-field',
  'deliver.progress',
  'deliver.meter',
  'deliver.input-otp',
  'deliver.calendar',
  'deliver.date-picker',
  'deliver.resizable',
  'deliver.carousel',
  'deliver.message-scroller',
  'deliver.tree',
  'deliver.virtual-list',
  'deliver.data-table',
  'baseline.async-region',
  'baseline.button',
  'baseline.checkbox',
  'baseline.dialog',
  'baseline.dropdown',
  'baseline.hover-card',
  'baseline.image',
  'baseline.input',
  'baseline.live-region',
  'baseline.radio-group',
  'baseline.scroll-area',
  'baseline.select',
  'baseline.separator',
  'baseline.surface',
  'baseline.switch',
  'baseline.table',
  'baseline.tabs',
  'baseline.text',
  'baseline.textarea',
  'baseline.toggle',
  'baseline.tooltip',
  'baseline.transition',
  'repair.overlay-scrollbar-coordinate',
]);
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const dataPath = 'internal/coverage-matrices/prototype-coverage-matrix.json';
export const markdownPath = 'internal/coverage-matrices/prototype-coverage-matrix.md';
const esc = (x) =>
  String(x ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
const table = (heads, rows) =>
  [heads, heads.map(() => '---'), ...rows].map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
const issue = (n) => `[#${n}](https://github.com/Proto-UI/Proto-UI/issues/${n})`;
const count = (xs) =>
  Object.fromEntries([...new Set(xs)].sort().map((x) => [x, xs.filter((y) => x === y).length]));
const equal = (a, b) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const setEqual = (a, b) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  [...a].sort().every((x, i) => x === [...b].sort()[i]);
export function inheritedPrototypeIds(text) {
  return (parseYaml(text).inherits?.prototypes ?? []).map((x) =>
    typeof x === 'string' ? x : x.id
  );
}
export function consumerLedgerRows(text) {
  const body = text.split('<!-- coverage-matrix:start')[1]?.split('<!-- coverage-matrix:end')[0];
  if (!body) throw new Error('Missing consumer matrix markers');
  const split = (line) => {
    const cells = [];
    let cell = '';
    const inner = line.trim().slice(1, -1);
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '\\' && inner[i + 1] === '|') {
        cell += '|';
        i++;
      } else if (inner[i] === '|') {
        cells.push(cell.trim().replace(/^`+|`+$/g, ''));
        cell = '';
      } else cell += inner[i];
    }
    cells.push(cell.trim().replace(/^`+|`+$/g, ''));
    return cells;
  };
  const lines = body.split(/\r?\n/).filter((x) => x.trim().startsWith('|'));
  const headers = split(lines[0]);
  const rows = new Map();
  for (const line of lines.slice(2)) {
    const cells = split(line);
    if (cells.length !== headers.length) throw new Error('Consumer matrix column mismatch');
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    if (rows.has(row.ID)) throw new Error('Duplicate source consumer ID');
    rows.set(row.ID, row);
  }
  return { headers, rows };
}
export function validate(data, repoRoot = root) {
  const errors = [];
  const require = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const rows = data.comparisonRows;
  require(data.schemaVersion === 1, 'Unsupported schema version');
  require(data.tracker === 870, 'Active tracker must be explicit');
  require(new Set(rows.map((r) => r.id)).size === rows.length, 'Duplicate comparison ID');
  const sh = rows.filter((r) => r.referenceProjects.some((s) => s.project === 'shadcn/ui'));
  const ba = rows.filter((r) => r.referenceProjects.some((s) => s.project === 'Base UI'));
  require(sh.length === data.referenceSnapshots.shadcn.directoryCount, 'shadcn denominator drift');
  require(ba.length === data.referenceSnapshots.baseUi.directoryCount, 'Base UI denominator drift');
  require(rows.length === data.counts.comparisonUnion, 'Union count drift');
  require(sh.filter((r) => ba.includes(r)).length ===
    data.counts.comparisonIntersection, 'Intersection count drift');
  require(ba.filter((r) => r.base).length ===
    data.counts.baseUiMainCounterparts, 'Base UI counterpart count drift');
  require(ba.filter((r) => !r.base).length ===
    data.counts.baseUiNoMainCounterpart, 'Base UI absence count drift');
  require(sh.filter((r) => r.projections.shadcn.status === 'implemented-draft').length ===
    data.counts.shadcnNamedProjections, 'Shadcn projection count drift');
  require(equal(
    count(rows.map((r) => r.classification)),
    data.counts.comparisonClassCounts
  ), 'Classification count drift');
  require(equal(
    count(
      sh
        .filter((r) => r.projections.shadcn.status !== 'implemented-draft')
        .map((r) => r.classification)
    ),
    data.counts.shadcnDifferenceClassCounts
  ), 'Shadcn difference classification count drift');
  const entities = [];
  const inheritance = new Map();
  for (const [lib, families] of Object.entries(data.prototypeInventory)) {
    const values = Object.values(families);
    const n = data.counts.libraryInventory[lib];
    require(values.length === n.families, `${lib} family count drift`);
    require(values.flatMap((f) => f.entityIds).length === n.entities, `${lib} part count drift`);
    const sourcePaths = values.flatMap((f) => f.sourceFiles);
    require(sourcePaths.length === n.sourceFiles, `${lib} source count drift`);
    const actualSourcePaths = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(full);
        else if (entry.isFile() && entry.name.endsWith('.proto.ts'))
          actualSourcePaths.push(path.relative(repoRoot, full).split(path.sep).join('/'));
      }
    };
    visit(path.join(repoRoot, `packages/prototypes/${lib}/src`));
    require(setEqual(sourcePaths, actualSourcePaths), `${lib} source identity set drift`);
    for (const f of values) {
      for (const id of f.entityIds) {
        entities.push(id);
        if (!/^P-[A-Z0-9-]+$/.test(id)) {
          errors.push(`Invalid entity ID: ${id}`);
          continue;
        }
        const file = path.join(repoRoot, `spec/prototypes/${id}.yaml`);
        require(fs.existsSync(file), `Missing entity: ${id}`);
        if (fs.existsSync(file)) {
          inheritance.set(id, inheritedPrototypeIds(fs.readFileSync(file, 'utf8')));
          require(/^status: draft$/m.test(
            fs.readFileSync(file, 'utf8')
          ), `Lifecycle changed: ${id}; refresh matrix`);
        }
      }
      for (const p of [...f.sourceFiles, ...f.tests]) {
        if (path.isAbsolute(p) || p.split('/').includes('..')) {
          errors.push(`Unsafe source path: ${p}`);
          continue;
        }
        require(fs.existsSync(path.join(repoRoot, p)), `Missing source: ${p}`);
      }
    }
  }
  require(new Set(entities).size === entities.length, 'Duplicate P identity in inventory');
  require(entities.length === data.counts.catalogEntities, 'Catalog count drift');
  require(data.counts.catalogDraft === entities.length &&
    data.counts.catalogActive === 0, 'Snapshot lifecycle totals drift');
  const actualEntities = fs
    .readdirSync(path.join(repoRoot, 'spec/prototypes'))
    .filter((p) => /^P-.*\.yaml$/.test(p));
  require(actualEntities.length ===
    entities.length, 'Live catalog changed; refresh source snapshot and counts');
  require(data.projectionRows.length ===
    data.counts.libraryInventory.base.families, 'Base projection denominator drift');
  const familyKeys = ['bootstrap-2-3-2', 'brutalist', 'liquid-glass', 'shadcn'];
  const baseFamilies = Object.keys(data.prototypeInventory.base);
  require(setEqual(
    data.projectionRows.map((p) => p.base.family),
    baseFamilies
  ), 'Base projection family set drift or duplicates');
  require(new Set(data.projectionRows.map((p) => p.id)).size ===
    data.projectionRows.length, 'Duplicate projection row ID');
  for (const p of data.projectionRows) {
    require(setEqual(Object.keys(p.families), familyKeys), `Missing projection column: ${p.id}`);
    require(p.id === `projection.${p.base.family}` &&
      setEqual(
        p.base.entityIds,
        data.prototypeInventory.base[p.base.family]?.entityIds ?? []
      ), `Projection Base identity mismatch: ${p.id}`);
  }
  const baseIds = Object.values(data.prototypeInventory.base).flatMap((f) => f.entityIds);
  const mapping = data.atomicProjectionMapping ?? [];
  require(setEqual(
    mapping.map((r) => r.baseIdentity),
    baseIds
  ), 'Atomic Base identity set drift or duplicates');
  for (const r of mapping) {
    require(setEqual(
      Object.keys(r.projectionCells ?? {}),
      familyKeys
    ), `Atomic projection columns drift: ${r.baseIdentity}`);
    for (const lib of familyKeys) {
      const ids = Object.values(data.prototypeInventory[lib]).flatMap((f) => f.entityIds);
      const expected = ids.filter((id) => (inheritance.get(id) ?? []).includes(r.baseIdentity));
      const actual = r.projectionCells?.[lib]?.mappedCurrentIdentities ?? [];
      require(setEqual(
        actual,
        expected
      ), `Atomic inheritance mismatch: ${r.baseIdentity} -> ${lib}`);
    }
  }
  const consumerIds = new Set(data.consumerRows.map((r) => r.ID));
  require(consumerIds.size === data.consumerRows.length, 'Duplicate consumer ID');
  for (const r of rows) {
    require(Boolean(
      r.decision && r.partialOrNegativeBoundary
    ), `Missing decision/negative boundary: ${r.id}`);
    for (const id of r.consumerRows)
      require(consumerIds.has(id), `Unresolved consumer row: ${r.id} -> ${id}`);
  }
  for (const [program, summary] of Object.entries(data.counts.consumerPrograms)) {
    const actual = data.consumerRows.filter((r) => r.program === program);
    require(actual.length === summary.rows &&
      equal(
        count(actual.map((r) => r.State)),
        summary.states
      ), `Consumer totals drift: ${program}`);
    const source = fs.readFileSync(path.join(repoRoot, actual[0].source), 'utf8');
    const parsed = consumerLedgerRows(source);
    require(setEqual(
      [...parsed.rows.keys()],
      actual.map((r) => r.ID)
    ), `Consumer source row set drift: ${program}`);
    for (const r of actual)
      for (const field of parsed.headers)
        require(r[field] ===
          parsed.rows.get(r.ID)?.[field], `Consumer source field drift: ${r.ID}.${field}`);
  }
  require(data.migrationLedger.length ===
    data.counts.legacyLinksRechecked, 'Migration count drift');
  require(new Set(data.migrationLedger.map((r) => r.number)).size ===
    data.migrationLedger.length, 'Duplicate migration target');
  for (const r of data.migrationLedger)
    require(r.action === 'retain-existing-owner; no-close' &&
      Boolean(r.migration && r.url), `Missing migration disposition: ${r.number}`);
  const plan = data.deliveryPlan;
  require(Boolean(plan) && plan.items.length === plan.coreTodoCount, 'Finf task count drift');
  if (plan) {
    require(setEqual(
      plan.items.map((x) => x.id),
      FINF_CORE_ITEM_IDS
    ), 'Finf required item scope drift or duplicates');
    require(new Set(plan.priorWork.map((x) => x.pr)).size === plan.priorWork.length &&
      plan.priorWork.every((x) => x.id === `prior-pr.${x.pr}`), 'Finf prior work identity drift');
    for (const item of plan.priorWork) {
      if (item.complete) {
        const c = item.closeout;
        require(c &&
          ['merged-main', 'accepted-in-Finf'].includes(c.mode) &&
          c.sourcePullRequest === item.pr &&
          /^[a-f0-9]{40}$/.test(c.sourceHead ?? '') &&
          /^[a-f0-9]{40}$/.test(c.integrationRevision ?? '') &&
          /^https:\/\//.test(c.evidence ?? '') &&
          c.ci === 'passed' &&
          c.independentReview?.verdict === 'approved' &&
          c.independentReview?.revision === c.integrationRevision &&
          /^https:\/\//.test(
            c.independentReview?.source ?? ''
          ), `Incomplete prior work closeout: ${item.id}`);
      }
    }
    require(plan.items.filter((x) => x.complete).length ===
      plan.checkedCoreTodos, 'Finf completion count drift');
    require(plan.priorWork.length === plan.priorWorkRoutingCount, 'Finf prior work count drift');
    for (const item of plan.items) {
      const expectedRequirements =
        item.id === 'repair.overlay-scrollbar-coordinate'
          ? [...FINF_REQUIRED_DIMENSIONS, ...OVERLAY_REQUIRED_DIMENSIONS]
          : [...FINF_REQUIRED_DIMENSIONS];
      require(JSON.stringify(item.requirements) ===
        JSON.stringify(expectedRequirements), `Finf required dimensions drift: ${item.id}`);
      const gates = expectedRequirements.map((_, i) => String(i + 1));
      require(setEqual(
        Object.keys(item.gateResults ?? {}),
        gates
      ), `Finf gate identity mismatch: ${item.id}`);
      if (item.kind === 'complete-current-Base-four-projections')
        require(setEqual(
          item.baseEntityIds ?? [],
          data.prototypeInventory.base[item.name]?.entityIds ?? []
        ), `Finf baseline Base scope drift: ${item.id}`);
      if (item.complete) {
        const requiredBaseIds = item.baseEntityIds ?? [];
        require(requiredBaseIds.length > 0 &&
          new Set(requiredBaseIds).size === requiredBaseIds.length &&
          requiredBaseIds.every((id) =>
            baseIds.includes(id)
          ), `Incomplete Finf Base scope: ${item.id}`);
        for (const id of requiredBaseIds)
          for (const lib of familyKeys) {
            const cell = mapping.find((r) => r.baseIdentity === id)?.projectionCells?.[lib];
            require(cell?.mappedCurrentIdentities?.length > 0 &&
              cell.acceptance === 'passed' &&
              cell.mappedCurrentIdentities.every((projection) =>
                cell.evidence?.some(
                  (e) =>
                    e.projectionIdentity === projection &&
                    e.result === 'passed' &&
                    e.revision === item.acceptedRevision &&
                    /^https:\/\//.test(e.source ?? '')
                )
              ), `Incomplete Finf projection acceptance: ${item.id} -> ${id}/${lib}`);
          }
        const receiptFor = (gate) =>
          (item.evidence ?? []).some(
            (r) =>
              r &&
              typeof r === 'object' &&
              r.gate === gate &&
              r.result === 'passed' &&
              /^[a-f0-9]{40}$/.test(r.revision ?? '') &&
              r.revision === item.acceptedRevision &&
              /^https:\/\//.test(r.source ?? '') &&
              typeof r.kind === 'string' &&
              r.kind.length > 0
          );
        const review = item.independentReview;
        require(Object.values(item.gateResults).every((x) => x === 'passed') &&
          gates.every(receiptFor) &&
          /^[a-f0-9]{40}$/.test(item.acceptedRevision ?? '') &&
          review?.revision === item.acceptedRevision &&
          review?.verdict === 'approved' &&
          typeof review?.reviewer === 'string' &&
          review.reviewer.length > 0 &&
          /^https:\/\//.test(review.source ?? ''), `Incomplete Finf acceptance: ${item.id}`);
      }
    }
  }
  return errors;
}
export function renderPlan(d) {
  const p = d.deliveryPlan;
  return (
    [
      '# Finf complete-delivery checklist',
      `Tracker: ${issue(d.tracker)}. Status: **work in progress, not merge-ready**. ${p.initialTodoCount} initial unchecked items: ${p.coreTodoCount} full delivery items and ${p.priorWorkRoutingCount} existing-PR closeout/carry items.`,
      p.scope,
      p.completionRule,
      '## One checkbox means all acceptance gates',
      ...FINF_REQUIRED_DIMENSIONS.map((x, i) => `${i + 1}. ${x}`),
      p.projectionInvariant,
      p.finalBaseCount,
      '## Full feature and projection items',
      ...p.items.map(
        (x) =>
          `- [${x.complete ? 'x' : ' '}] **${x.id}**: ${x.name}. Group: ${x.group}. Existing work: ${x.issues.map(issue).join(', ')}. All gates above are mandatory; partial commits do not check this item.`
      ),
      '## Previous work remains equal priority',
      ...p.priorWork.map(
        (x) =>
          `- [${x.complete ? 'x' : ' '}] **${x.id}** ${issue(x.pr)}: ${x.disposition}. ${x.publication}.`
      ),
      'The shared benchmark bootstrap repair is tracked by #871 and remains with its current owner until an exact frozen integration receipt is accepted. #826 and #846 are **NEVER MERGE**, evidence-only branches.',
      '## Retained prior-work acceptance details',
      ...p.priorWork
        .filter((x) => x.mandatoryUnfinishedCriteria)
        .flatMap((x) => [
          x.boundedPriorSuccess,
          ...x.mandatoryUnfinishedCriteria.map(
            (c) => `- **${c.id}** (unmet): ${c.acceptance} [source](${c.source})`
          ),
        ]),
      `Shared CI hygiene (unmet): ${p.sharedCiHygiene.observed} ${p.sharedCiHygiene.required} [failure](${p.sharedCiHygiene.source})`,
      '## Atomic parity obligations',
      'Each cell below is required. An existing draft inheritance mapping is source evidence only and has not passed the full Finf acceptance gate.',
      table(
        [
          'Base atomic identity',
          'Shadcn',
          'Neobrutalism (brutalist)',
          'Bootstrap 2.3.2',
          'Liquid Glass',
        ],
        d.atomicProjectionMapping.map((x) => [
          x.baseIdentity,
          ...['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'].map(
            (l) => x.projectionCells[l].mappedCurrentIdentities.join(', ') || 'required missing'
          ),
        ])
      ),
      '## Integration discipline',
      p.singleIntegrationOwner,
      'Continue old PRs in place while they can be finished normally. For a carry, retain frozen source, original author/provenance, exact failures, unresolved criteria and evidence links. Do not rewrite history or close an unfinished item as fixed. Only the integrator updates this Finf ref with an expected-head lease. No new leaf PR is required for an internal Finf topic slice; independent review, CI, DCO, repository protection and actual semantic boundaries remain mandatory.',
      ...OVERLAY_REQUIRED_DIMENSIONS.map((x) => '- Required Overlay evidence: ' + x),
      'Overlay root cause is not yet reproduced. The scrollbar-coordinate regression must retain actual baseline, repaired real-input journeys and every dependent anchored/portaled composition; it cannot be checked from a guessed offset patch.',
      p.materialBoundary,
      p.packagingBoundary,
      'Agent: dot  \nModelTrace: not measured — owner-authorized dot exemption (2026-10-06)',
    ].join('\n\n') + '\n'
  );
}
export function render(d) {
  const source = (p) => `[${p}](https://github.com/Proto-UI/Proto-UI/blob/${d.protoMain}/${p})`;
  const c = d.counts;
  const t = (s) => s.replaceAll('-', ' ');
  const sections = [
    '# Active prototype comparison and four-family projection matrix',
    `Status: non-normative operational inventory. Tracker: ${issue(d.tracker)}. Observed ${d.observedAt}; Proto UI main \`${d.protoMain}\`. This replaces #377 as the active matrix entry without closing existing implementation or consumer trackers. Generated from [the structured matrix](prototype-coverage-matrix.json) by \`node scripts/coverage-matrices/prototype-coverage.mjs --write\`.`,
    '## Independent project and counting boundary',
    d.referencePolicy,
    'A comparison difference alone is not a defect or a new Base obligation. The maintainer has separately selected the complete Finf groups 1–6, all four projections and the Overlay regression as explicit project-owned work. `candidate-needs-independent-admission` means research, not approval. Existing historical `UPSTREAM-*` reference IDs retain source identity only; this document neither renames them nor grants another project authority. Actual technical dependencies and licenses remain unchanged.',
    'A family is one subject, not the sum of Root/Trigger/Content parts. A P identity is a cataloged part or projection, not an unrelated component. Direct/asHook authoring entries share one protocol; Transition therefore has two source files but one part. Generated Lucide glyphs share one Icon protocol. Framework repetitions and private application compositions are separate inventories.',
    table(
      ['Library', 'Families', 'P identities', 'Source definitions'],
      Object.entries(c.libraryInventory).map(([k, v]) => [k, v.families, v.entities, v.sourceFiles])
    ),
    `Total: **${c.familyInstances} library-family instances; ${c.distinctPrototypeSubjects} distinct subjects; ${c.catalogEntities} P identities; ${c.catalogDraft} draft / ${c.catalogActive} active P identities**. This is an implementation inventory, not zero usable code and not a count of mature components. The private ChatUI Message/Code Block compositions add 6/3 package-local parts but no public P identities.`,
    '## Reference sets and difference accounting',
    table(
      ['Comparison source', 'Pinned evidence', 'Denominator', 'Main counterpart'],
      [
        [
          '[shadcn/ui directory](https://ui.shadcn.com/docs/components)',
          d.referenceSnapshots.shadcn.sha,
          `${d.referenceSnapshots.shadcn.directoryCount} directory subjects`,
          `${c.shadcnNamedProjections} named Shadcn projections; all bounded draft`,
        ],
        [
          '[Base UI components](https://base-ui.com/react/overview/quick-start)',
          d.referenceSnapshots.baseUi.sha + '; docs ' + d.referenceSnapshots.baseUi.docsVersion,
          `${d.referenceSnapshots.baseUi.directoryCount} component families`,
          `${c.baseUiMainCounterparts} bounded Base counterparts; ${c.baseUiNoMainCounterpart} without a corresponding main family`,
        ],
      ]
    ),
    `**Intersection ${c.comparisonIntersection}; union ${c.comparisonUnion}.** Aliases: Base UI Menu ↔ Dropdown Menu; Preview Card ↔ Hover Card; OTP Field ↔ Input OTP. Radio is counted inside Radio Group. Autocomplete/Combobox and Progress/Meter remain distinct. These aliases mean comparable subject, never interchangeable API.`,
    `The ${c.comparisonUnion}-subject union contains ${c.comparisonClassCounts['behavior-or-structure']} behavior/structure comparison names, ${c.comparisonClassCounts['styled-only']} styled-only subjects, ${c.comparisonClassCounts.composition} compositions, ${c.comparisonClassCounts['provider/system']} provider/environment subject and ${c.comparisonClassCounts.excluded} currently excluded domain. Of the behavior/structure subjects, ${d.comparisonRows.filter((r) => r.classification === 'behavior-or-structure' && r.base).length} have Base source counterparts and ${d.comparisonRows.filter((r) => r.classification === 'behavior-or-structure' && !r.base).length} do not. Several absent names can be realized by composition; this difference is not an admitted new-Base count.`,
    `The ${d.referenceSnapshots.shadcn.directoryCount - c.shadcnNamedProjections} shadcn names without a named Shadcn projection split into **${c.shadcnDifferenceClassCounts['behavior-or-structure']} behavior/structure, ${c.shadcnDifferenceClassCounts['styled-only']} visual, ${c.shadcnDifferenceClassCounts.composition} composition, ${c.shadcnDifferenceClassCounts['provider/system']} environment and ${c.shadcnDifferenceClassCounts.excluded} excluded**. Table already exists in Base; Badge/Card/Skeleton/Spinner already exist in Brutalist; Message already exists as a private composition. Current Base UI counterparts and named Shadcn projections are bounded subsets, not full feature parity.`,
    '### Base UI comparison names without a main family',
    d.comparisonRows
      .filter((r) => !r.base && r.referenceProjects.some((s) => s.project === 'Base UI'))
      .map((r) => r.name)
      .join(', ') + '.',
    '## Per-subject comparison',
    'Every row has exact P identities, source/tests, reference revision, four design-family cells, consumer row IDs, independent adoption decision and previous tracker entry in JSON. “Missing main family” does not erase reusable foundations or open work. Full-reference parity and fresh runtime certification are **not assessed** in this source audit.',
    table(
      [
        'Subject / references',
        'Class / decision',
        'Pinned main implementation',
        'Ownership / remaining boundary',
        'Consumer row IDs',
        'Existing work',
      ],
      d.comparisonRows.map((r) => [
        r.referenceProjects
          .map((s) => `[${s.label}](${s.url}) ([pin](${s.pinnedSource}))`)
          .join('; '),
        `${r.classification}; ${r.decision}`,
        `${r.mainStatus}${r.base ? '; ' + r.base.entityIds.map((id) => `[${id}](https://github.com/Proto-UI/Proto-UI/blob/${d.protoMain}/spec/prototypes/${id}.yaml)`).join(', ') : ''}`,
        r.partialOrNegativeBoundary,
        r.consumerRows.join(', ') || 'No current consumer row; independent scope needed',
        r.issues.map(issue).join(', ') || issue(d.tracker),
      ])
    ),
    '## Four design-language cells on the same Base rows',
    'Bootstrap refers only to [2.3.2](https://getbootstrap.com/2.3.2/components.html); it does not import modern Bootstrap v5 scope. Liquid Glass is independently authored. The owner explicitly selected complete four-family coverage in this Finf task: missing cells are required work, including semantic-only atoms. Faithful semantic reuse is allowed; no absent identity, placeholder or CSS-only skin counts as completion. This project-owned scope does not require copying all comparison-project features. Existing projection parts can be more/fewer than Base anatomy, so family coverage does not prove part-by-part parity.',
    table(
      ['Base family / part count', 'Shadcn', 'Brutalist', 'Bootstrap 2.3.2', 'Liquid Glass'],
      d.projectionRows.map((r) => [
        `${r.base.family} / ${r.base.entityCount}`,
        ...['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'].map(
          (k) =>
            `${r.families[k].status}${r.families[k].partCount ? ' / ' + r.families[k].partCount + ' parts' : ''}`
        ),
      ])
    ),
    'Brutalist-only direct styled subjects: Badge, Card, Skeleton and Spinner. They retain their existing visual contracts; Surface availability is a reason for a separately governed reuse review, not an automatic identity rewrite. Lucide Icon is shared icon projection, not a fifth competing control design system.',
    '### Liquid Glass realization boundary',
    '- Registered Button: bounded CSS alpha fill / 4px backdrop blur, gated on current preference/support facts, with opaque fallback. Registered Surface: neutral opaque presentation.\n- Merged #809: owned-scene **WebGL / GLSL ES 1.00** experiment via `packages/adapters/web-component/src/material/owned-texture-sink.ts` and `experiments/material-specializer/compile.mjs`; #855 repairs remain separate. A material declaration is not implemented WebGPU or Vulkan support.\n- Apple-native material: future shared Adapter/Compiler mapping direction only. No SwiftUI/UIKit/AppKit material backend, cross-version native certification or unrestricted desktop/DOM sampling is claimed.',
    source('internal/records/2026-10-04-native-material-lowering-direction.md'),
    '## Finf complete-delivery plan',
    `The maintainer has selected **${d.deliveryPlan.coreTodoCount} full-acceptance core items**, plus ${d.deliveryPlan.priorWorkRoutingCount} prior-PR carry/closeout items. ${d.deliveryPlan.checkedCoreTodos} core items are checked complete; the remaining items retain their full acceptance gates. The [complete checkbox ledger](finf-delivery-checklist.md) is the execution entry. Final Base counts grow only through governed identities; all four projections must match each final Base identity rather than reaching a number with duplicates.`,
    '## Highest-leverage abstraction work',
    'Direct-benefit counts below overlap and are not additive. The selected Finf groups are authorized for complete delivery; the remaining comparison names keep their independent adoption decisions. Workstreams never justify one Module per comparison name. Existing foundations are draft unless their own entity says otherwise.',
    table(
      [
        'Priority / workstream',
        'Direct comparison subjects',
        'Existing foundation',
        'Missing ownership / next step',
        'Current owner links',
      ],
      d.workstreams.map((w) => [
        `${w.priority}: ${w.id}`,
        `${w.directComparatorFamilyCount}: ${w.families.join(', ')}`,
        w.reuse.join(', '),
        w.gap,
        w.issues.map(issue).join(', '),
      ])
    ),
    '## Our own consumer matrices and additional scope',
    'These matrices count user-facing jobs, not prototype families. Their exact row IDs, owners, accepted boundaries, issue links and original states are retained in the JSON and their dedicated ledgers. No consumer state is promoted by this refresh.',
    table(
      ['Program', 'Rows', 'Recorded states', 'Dedicated ledger'],
      Object.entries(c.consumerPrograms).map(([k, v]) => [
        k,
        v.rows,
        Object.entries(v.states)
          .map(([s, n]) => `${s}: ${n}`)
          .join('; '),
        k === 'website'
          ? '[Website](../website/self-hosting-coverage-matrix.md)'
          : '[Harness](../agent-harness/dogfood-coverage-matrix.md)',
      ])
    ),
    d.ownScopeBeyondComparators.map((x) => '- ' + x).join('\n'),
    'The App keeps domain truth, backend transport, file storage, credentials, navigation and execution decisions. UI primitives expose semantic requests; rendering/remounts must not send, delete, approve or retry. HIG comparison remains #864/#869: its 158 article rows are not 158 missing components.',
    '## Fresh migration ledger',
    `**${d.migrationLedger.length} Issue/PR references re-read** (93 carried references plus 8 directly relevant current dependencies). The old #377 body is preserved in [this dated snapshot](snapshots/2026-10-06-issue-377-before-migration.md). Closed/merged is a GitHub state, not proof of current runtime, lifecycle admission or consumer acceptance. Historical unchecked criteria are preserved in JSON but require reconciliation; they are not blindly re-opened.`,
    table(
      ['Issue / PR', 'Fresh observed state', 'Carried result, debt and routing'],
      d.migrationLedger.map((r) => [
        `${issue(r.number)} ${r.title}`,
        r.pr
          ? (r.pr.merged ? 'merged' : 'open' === r.state ? 'open PR' : 'closed unmerged') +
            (r.pr.head ? `; head ${r.pr.head}` : '')
          : r.state,
        r.migration,
      ])
    ),
    '## Package consumption boundary',
    'Bootstrap 2.3.2 and Liquid Glass currently declare private: true and source exports. Their existing counts describe workspace implementations, not npm publication. Four-family implementation and runtime/visual parity remain required in Finf; private package status is not a waiver. Changing release identity/publication requires its own explicit release authorization.',
    '## Verification and update contract',
    '- Source/count/link and receipt-shape integrity (never a substitute for independent review of actual evidence): `node scripts/coverage-matrices/prototype-coverage.mjs --check`. Negative controls: `node --test scripts/coverage-matrices/test/prototype-coverage.test.mjs`.\n- Refresh main and reference revisions before changing facts; update the JSON and regenerate this view. New reference names enter independent review, never automatic scope.\n- Every adopted row needs a real owner, precise semantic/negative boundary, main/open-PR separation, lifecycle, host/Compiler evidence and consumer acceptance. Closing the matrix PR does not close #870.\n- This audit does not rerun prototype/runtime/visual tests. Existing mapped tests are source evidence only; no full-feature or native certification is claimed. Independent review and exact-head CI remain required for the matrix change.',
    'Agent: dot  \nModelTrace: not measured — owner-authorized dot exemption (2026-10-06)',
  ];
  return sections.join('\n\n') + '\n';
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(fs.readFileSync(path.join(root, dataPath), 'utf8'));
  const errors = validate(data);
  const output = render(data);
  const planOutput = renderPlan(data);
  const planPath = path.join(root, 'internal/coverage-matrices/finf-delivery-checklist.md');
  if (process.argv.includes('--write') && errors.length === 0) {
    fs.writeFileSync(path.join(root, markdownPath), output);
    fs.writeFileSync(planPath, planOutput);
  } else if (
    !fs.existsSync(path.join(root, markdownPath)) ||
    fs.readFileSync(path.join(root, markdownPath), 'utf8') !== output
  )
    errors.push('Readable view is stale; run with --write');
  if (!fs.existsSync(planPath) || fs.readFileSync(planPath, 'utf8') !== planOutput)
    errors.push('Finf checklist view is stale');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `Prototype coverage: ${data.comparisonRows.length} comparison rows, ${data.projectionRows.length} Base projection rows, ${data.consumerRows.length} consumer rows, ${data.migrationLedger.length} migrated links verified.`
    );
}
