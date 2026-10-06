import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const entities = [];
  for (const [lib, families] of Object.entries(data.prototypeInventory)) {
    const values = Object.values(families);
    const n = data.counts.libraryInventory[lib];
    require(values.length === n.families, `${lib} family count drift`);
    require(values.flatMap((f) => f.entityIds).length === n.entities, `${lib} part count drift`);
    for (const f of values) {
      for (const id of f.entityIds) {
        entities.push(id);
        if (!/^P-[A-Z0-9-]+$/.test(id)) {
          errors.push(`Invalid entity ID: ${id}`);
          continue;
        }
        const file = path.join(repoRoot, `spec/prototypes/${id}.yaml`);
        require(fs.existsSync(file), `Missing entity: ${id}`);
        if (fs.existsSync(file))
          require(/^status: draft$/m.test(
            fs.readFileSync(file, 'utf8')
          ), `Lifecycle changed: ${id}; refresh matrix`);
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
  for (const p of data.projectionRows)
    require(Object.keys(p.families).sort().join(',') ===
      'bootstrap-2-3-2,brutalist,liquid-glass,shadcn', `Missing projection column: ${p.id}`);
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
    for (const r of actual) require(source.includes(r.ID), `Consumer ID removed: ${r.ID}`);
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
    require(plan.items.filter((x) => x.complete).length ===
      plan.checkedCoreTodos, 'Finf completion count drift');
    require(plan.priorWork.length === plan.priorWorkRoutingCount, 'Finf prior work count drift');
    for (const item of plan.items)
      if (item.complete)
        require(item.evidence.length > 0 &&
          Object.values(item.gateResults ?? {}).length >= 7 &&
          Object.values(item.gateResults).every(
            (x) => x === 'passed'
          ), `Incomplete Finf acceptance: ${item.id}`);
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
      ...p.items[0].requirements.map((x, i) => `${i + 1}. ${x}`),
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
      'The shared benchmark bootstrap repair is awaiting its verified PR number and remains with its current owner; add its exact frozen receipt before integration. #826 and #846 are **NEVER MERGE**, evidence-only branches.',
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
      'Overlay root cause is not yet reproduced. The scrollbar-coordinate regression must retain actual baseline, repaired real-input journeys and every dependent anchored/portaled composition; it cannot be checked from a guessed offset patch.',
      p.materialBoundary,
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
    `Total: **${c.familyInstances} library-family instances; ${c.distinctPrototypeSubjects} distinct subjects; ${c.catalogEntities} P identities, all draft; 0 active P identities**. This is an implementation inventory, not zero usable code and not 159 mature components. The private ChatUI Message/Code Block compositions add 6/3 package-local parts but no public P identities.`,
    '## Reference sets and difference accounting',
    table(
      ['Comparison source', 'Pinned evidence', 'Denominator', 'Main counterpart'],
      [
        [
          '[shadcn/ui directory](https://ui.shadcn.com/docs/components)',
          d.referenceSnapshots.shadcn.sha,
          '64 directory subjects',
          '15 named Shadcn projections; all bounded draft',
        ],
        [
          '[Base UI components](https://base-ui.com/react/overview/quick-start)',
          d.referenceSnapshots.baseUi.sha + '; docs 1.8.0',
          '37 component families',
          '14 bounded Base counterparts; 23 without a corresponding main family',
        ],
      ]
    ),
    '**Intersection 30; union 71.** Aliases: Base UI Menu ↔ Dropdown Menu; Preview Card ↔ Hover Card; OTP Field ↔ Input OTP. Radio is counted inside Radio Group. Autocomplete/Combobox and Progress/Meter remain distinct. These aliases mean comparable subject, never interchangeable API.',
    'The 71-subject union contains 46 behavior/structure comparison names, 6 styled-only subjects, 17 compositions, Direction as one provider/environment subject and Chart as one currently excluded domain. Of the 46, 16 have Base source counterparts and 30 do not; several absent names can be realized by composition, so **30 is not an admitted new-Base count**.',
    'The 49 shadcn names without a named Shadcn projection split into **24 behavior/structure, 6 visual, 17 composition, 1 environment and 1 excluded**. Table already exists in Base; Badge/Card/Skeleton/Spinner already exist in Brutalist; Message already exists as a private composition. Current Base UI counterparts and named Shadcn projections are bounded subsets, not full feature parity.',
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
    `The maintainer has selected **${d.deliveryPlan.coreTodoCount} full-acceptance core items**, plus ${d.deliveryPlan.priorWorkRoutingCount} prior-PR carry/closeout items. None is checked complete. The [complete checkbox ledger](finf-delivery-checklist.md) is the execution entry. Final Base counts grow only through governed identities; all four projections must match each final Base identity rather than reaching a number with duplicates.`,
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
    '## Verification and update contract',
    '- Source/count/link integrity: `node scripts/coverage-matrices/prototype-coverage.mjs --check`. Negative controls: `node --test scripts/coverage-matrices/test/prototype-coverage.test.mjs`.\n- Refresh main and reference revisions before changing facts; update the JSON and regenerate this view. New reference names enter independent review, never automatic scope.\n- Every adopted row needs a real owner, precise semantic/negative boundary, main/open-PR separation, lifecycle, host/Compiler evidence and consumer acceptance. Closing the matrix PR does not close #870.\n- This audit does not rerun prototype/runtime/visual tests. Existing mapped tests are source evidence only; no full-feature or native certification is claimed. Independent review and exact-head CI remain required for the matrix change.',
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
