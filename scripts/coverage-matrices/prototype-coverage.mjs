import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

export const FINF_REQUIRED_DIMENSIONS = Object.freeze([
  'Complete governed semantic contract and explicit negative boundaries; no simplified interim version marked done',
  'Final Base identities mapped atom-by-atom to Shadcn, Neobrutalism (package brutalist), Bootstrap 2.3.2 and Liquid Glass',
  'Every applicable Module/Host Capability/Adapter profile and generated Compiler target has verified conformance; unsupported/omitted scope explicitly governed, never counted as a pass',
  'Complete source/dist exports, build and type artifacts, install/consumer smoke from local packed artifacts, package/CLI surface, DemoSpec, reachable real demos and bilingual documentation. Registry publication is a separate explicitly authorized release action. Every newly introduced prototype also requires a catalog-driven interactive homepage exhibition and state set built from its real atoms. Bootstrap 2.3.2 Classic and Liquid Glass homepage selection remains ineligible until complete Base atomic parity and mature applicable evidence.',
  'Controlled/uncontrolled, disabled/readOnly, keyboard/pointer/touch/IME where applicable, accessibility, repeated mount/unmount and interruption paths',
  'Real-input runtime and commit-bound visual evidence for all affected compositions/overlay dependants and four design languages',
  'Focused and applicable aggregate tests plus trusted exact-head CI/DCO and independent review; no outstanding applicable findings',
  'Complete the per-family and per-atomic-identity safe-area/spacing audit and accepted repairs across Base and all four design languages: explicit viewport/container/leaf ownership, outer and inner spacing, long content, scaling and keyboard reflow. Use family-specific evidence, not a universal inset or an unsupported not-applicable shortcut.',
  'Deliver GPUI with the same applicable semantic capability as the other runtimes for this prototype and all four design-language projections: actual input, focus, accessibility, layout, theme, demo and Adapter/Compiler evidence. Existing private/experimental status or unsupported diagnostics are current gaps, never a final omission or completion shortcut. The homepage Runtime entry must launch or display actual native GPUI with an explicit integration boundary and native input/layout/accessibility evidence; a Web projection must never impersonate GPUI.',
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
const FINF_REQUIRED_PRIOR_PRS = Object.freeze([
  775, 832, 863, 858, 868, 857, 855, 862, 867, 869, 808, 835, 871,
]);
const CONSUMER_LEDGERS = Object.freeze({
  website: 'internal/website/self-hosting-coverage-matrix.md',
  harness: 'internal/agent-harness/dogfood-coverage-matrix.md',
});
const LIFECYCLES = Object.freeze(['draft', 'active', 'deprecated', 'removed']);
const SUBJECT_ALIASES = Object.freeze({
  menu: 'dropdown-menu',
  'preview-card': 'hover-card',
  'otp-field': 'input-otp',
});
// Scope follows the selected subject, never an editable item name or arbitrary P identity.
const OVERLAY_BASE_FAMILIES = Object.freeze([
  'dialog',
  'dropdown',
  'hover-card',
  'select',
  'tooltip',
  'autocomplete',
  'combobox',
  'context-menu',
  'menubar',
  'navigation-menu',
  'popover',
  'alert-dialog',
  'drawer',
  'toast',
  'date-picker',
]);
const subjectFamily = (slug) => (slug === 'dropdown-menu' ? 'dropdown' : slug);
const lifecycleOf = (statuses) => {
  const unique = [...new Set(statuses)];
  return unique.length === 0 ? 'none' : unique.length === 1 ? unique[0] : 'mixed';
};
const normalizedUrl = (value) => {
  try {
    const url = new URL(value);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return value;
  }
};
const canonicalSubject = (slug, aliases) => {
  const seen = new Set();
  while (aliases[slug] && !seen.has(slug)) {
    seen.add(slug);
    slug = aliases[slug];
  }
  return slug;
};
const sourceSnapshot = (data) =>
  data.sourceSnapshot ?? {
    kind: 'main',
    revision: data.protoMain,
    baseMain: data.protoMain,
    objectType: 'commit',
  };
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
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stableJson = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item
  );
const MAIN_SOURCE_EVIDENCE_DIGESTS = Object.freeze({
  '25c3d0731e39003d87f541afc5e1a294a9d95568':
    '672221b761fc0b8ac2e63280529187166f0f516fc90ffd780c8aaa2c3d004abf',
});
const inventoryPaths = (inventory) =>
  [
    ...new Set(
      Object.entries(inventory).flatMap(([lib, families]) => [
        `packages/prototypes/${lib}/package.json`,
        ...Object.values(families).flatMap((f) => [
          ...f.sourceFiles,
          ...f.tests,
          ...f.entityIds.map((id) => `spec/prototypes/${id}.yaml`),
        ]),
      ])
    ),
  ].sort();

// Bind all implementation/export helpers and tests in the six source packages,
// not only the .proto.ts definitions used by the family-count denominator.
function candidateBindingPaths(inventory, repoRoot) {
  const paths = new Set(inventoryPaths(inventory));
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) paths.add(path.relative(repoRoot, file).split(path.sep).join('/'));
    }
  };
  for (const lib of Object.keys(inventory)) {
    visit(path.join(repoRoot, `packages/prototypes/${lib}/src`));
    visit(path.join(repoRoot, `packages/prototypes/${lib}/test`));
  }
  return [...paths].sort();
}

// This fixed historical evidence record supports offline/shallow checkouts.
// Updating its reviewed digest is a main-snapshot refresh, never live remote proof.
export function captureMainSourceEvidence(data, repoRoot) {
  const reader = gitSourceFs(repoRoot, data.protoMain);
  const paths = inventoryPaths(data.prototypeInventory);
  const catalog = {};
  const manifests = {};
  for (const p of paths) {
    if (p.startsWith('spec/prototypes/')) {
      const e = parseYaml(reader.readFileSync(path.join(repoRoot, p), 'utf8'));
      catalog[p] = {
        id: e.id,
        status: e.status,
        sources: e.sources ?? [],
        inherits: e.inherits ?? {},
      };
    } else if (p.endsWith('/package.json')) {
      const m = JSON.parse(reader.readFileSync(path.join(repoRoot, p), 'utf8'));
      manifests[p] = {
        name: m.name,
        private: m.private ?? false,
        version: m.version ?? null,
        exports: { '.': m.exports?.['.'] ?? null },
      };
    }
  }
  return {
    revision: data.protoMain,
    catalog,
    manifests,
    sourceBindings: paths.map((p) => ({
      path: p,
      sha256: sha256(reader.readFileSync(path.join(repoRoot, p))),
    })),
  };
}
function historicalSourceFs(evidence, repoRoot) {
  const files = new Map(evidence.sourceBindings.map((entry) => [entry.path, entry]));
  const relative = (file) => path.relative(repoRoot, file).split(path.sep).join('/');
  return {
    existsSync(file) {
      const p = relative(file);
      return files.has(p) || [...files.keys()].some((x) => x.startsWith(p + '/'));
    },
    readFileSync(file) {
      const p = relative(file);
      const fact = evidence.catalog[p] ?? evidence.manifests[p];
      if (!fact) throw new Error(`No historical parsed facts for ${p}`);
      return JSON.stringify(fact);
    },
    readdirSync(directory, options = {}) {
      const prefix = relative(directory) + '/';
      const entries = new Map();
      for (const name of files.keys()) {
        if (!name.startsWith(prefix)) continue;
        const [first, ...rest] = name.slice(prefix.length).split('/');
        entries.set(first, rest.length > 0);
      }
      return [...entries].map(([name, directory]) =>
        options.withFileTypes
          ? { name, isDirectory: () => directory, isFile: () => !directory }
          : name
      );
    },
  };
}

// Git objects are needed only when refreshing source evidence. Validation of a
// separate candidate uses stored historical facts and self-verifying Git tree
// proofs plus current bytes, so a shallow checkout needs no older Git objects.
const gitSnapshots = new Map();
function gitSourceFs(repoRoot, revision) {
  const key = repoRoot + ':' + revision;
  if (gitSnapshots.has(key)) return gitSnapshots.get(key);
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Invalid source object identity');
  const output = execFileSync(
    'git',
    ['ls-tree', '-rz', revision, '--', 'spec/prototypes', 'packages/prototypes'],
    { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 }
  ).toString();
  const files = new Map(
    output
      .split('\0')
      .filter(Boolean)
      .map((line) => {
        const [header, name] = line.split('\t');
        return [name, header.split(' ')[2]];
      })
  );
  const contents = new Map();
  const relative = (file) => path.relative(repoRoot, file).split(path.sep).join('/');
  const api = {
    existsSync(file) {
      const p = relative(file);
      return files.has(p) || [...files.keys()].some((x) => x.startsWith(p + '/'));
    },
    readFileSync(file, encoding) {
      const p = relative(file);
      if (!files.has(p)) throw new Error(`Source path absent from ${revision}: ${p}`);
      if (!contents.has(p))
        contents.set(
          p,
          execFileSync('git', ['cat-file', 'blob', files.get(p)], {
            cwd: repoRoot,
            maxBuffer: 16 * 1024 * 1024,
          })
        );
      return encoding ? contents.get(p).toString(encoding) : contents.get(p);
    },
    readdirSync(directory, options = {}) {
      const prefix = relative(directory) + '/';
      const entries = new Map();
      for (const name of files.keys()) {
        if (!name.startsWith(prefix)) continue;
        const tail = name.slice(prefix.length);
        const [first, ...rest] = tail.split('/');
        entries.set(first, rest.length > 0);
      }
      return [...entries].map(([name, directory]) =>
        options.withFileTypes
          ? { name, isDirectory: () => directory, isFile: () => !directory }
          : name
      );
    },
  };
  gitSnapshots.set(key, api);
  return api;
}

function gitObjectSha(type, bytes) {
  return createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest('hex');
}
function treeEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    const nul = bytes.indexOf(0, space + 1);
    if (space <= offset || nul < 0 || nul + 21 > bytes.length)
      throw new Error('Malformed Git object proof tree');
    const mode = bytes.subarray(offset, space).toString('ascii');
    const name = bytes.subarray(space + 1, nul).toString('utf8');
    if (!name || name.includes('/') || name === '.' || name === '..' || entries.has(name))
      throw new Error('Invalid Git object proof tree name');
    entries.set(name, { mode, sha: bytes.subarray(nul + 1, nul + 21).toString('hex') });
    offset = nul + 21;
  }
  return entries;
}
const gitProofSnapshots = new Map();
export function captureGitObjectProof(repoRoot, object, paths) {
  const key = repoRoot + ':' + object + ':' + sha256(paths.join('\0'));
  if (gitProofSnapshots.has(key)) return structuredClone(gitProofSnapshots.get(key));
  const read = (type, sha) =>
    execFileSync('git', ['cat-file', type, sha], {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024,
    });
  const objectType = read('-t', object).toString().trim();
  if (!['commit', 'tree'].includes(objectType))
    throw new Error('Candidate object is not commit/tree');
  const commit = objectType === 'commit' ? read('commit', object) : undefined;
  const rootTree = commit ? /^tree ([a-f0-9]{40})\n/.exec(commit.toString('utf8'))?.[1] : object;
  if (!rootTree) throw new Error('Candidate commit has no root tree');
  const trees = new Map();
  const parse = (sha) => {
    if (!trees.has(sha)) {
      const raw = read('tree', sha);
      if (gitObjectSha('tree', raw) !== sha) throw new Error('Git tree content hash mismatch');
      trees.set(sha, { sha, contentBase64: raw.toString('base64'), entries: treeEntries(raw) });
    }
    return trees.get(sha).entries;
  };
  for (const file of paths) {
    let tree = rootTree;
    const parts = file.split('/');
    for (let i = 0; i < parts.length; i++) {
      const entry = parse(tree).get(parts[i]);
      if (!entry) throw new Error(`Candidate Git tree is missing ${file}`);
      if (i < parts.length - 1) {
        if (!['40000', '040000'].includes(entry.mode))
          throw new Error(`Non-tree parent for ${file}`);
        tree = entry.sha;
      } else if (!['100644', '100755'].includes(entry.mode)) {
        throw new Error(`Candidate source is not a regular Git blob: ${file}`);
      }
    }
  }
  const proof = {
    objectType,
    rootTree,
    ...(commit ? { commitBase64: commit.toString('base64') } : {}),
    trees: [...trees.values()].map(({ sha, contentBase64 }) => ({ sha, contentBase64 })),
  };
  gitProofSnapshots.set(key, structuredClone(proof));
  return proof;
}
function gitProofBlob(candidate) {
  const object = candidate.revision ?? candidate.tree;
  const proof = candidate.sourceObjectProof;
  const type = candidate.revision ? 'commit' : 'tree';
  if (!proof || proof.objectType !== type || !/^[a-f0-9]{40}$/.test(proof.rootTree ?? ''))
    throw new Error('Missing or mismatched Git object proof');
  const decode = (text) => {
    if (typeof text !== 'string') throw new Error('Missing Git object proof bytes');
    const bytes = Buffer.from(text, 'base64');
    if (bytes.toString('base64') !== text) throw new Error('Noncanonical Git object proof bytes');
    return bytes;
  };
  if (type === 'commit') {
    const bytes = decode(proof.commitBase64);
    if (
      gitObjectSha('commit', bytes) !== object ||
      /^tree ([a-f0-9]{40})\n/.exec(bytes.toString('utf8'))?.[1] !== proof.rootTree
    )
      throw new Error('Git object proof does not match advertised Git object');
  } else if (proof.rootTree !== object || proof.commitBase64 !== undefined) {
    throw new Error('Git object proof does not match advertised Git object');
  }
  const trees = new Map();
  for (const entry of proof.trees ?? []) {
    const bytes = decode(entry.contentBase64);
    if (gitObjectSha('tree', bytes) !== entry.sha || trees.has(entry.sha))
      throw new Error('Git object proof tree hash/identity mismatch');
    trees.set(entry.sha, treeEntries(bytes));
  }
  return (file) => {
    let tree = proof.rootTree;
    const parts = file.split('/');
    for (let i = 0; i < parts.length; i++) {
      const entry = trees.get(tree)?.get(parts[i]);
      if (!entry) throw new Error(`Git object proof path missing: ${file}`);
      if (i < parts.length - 1) {
        if (!['40000', '040000'].includes(entry.mode))
          throw new Error(`Git object proof non-tree: ${file}`);
        tree = entry.sha;
      } else {
        if (!['100644', '100755'].includes(entry.mode))
          throw new Error(`Candidate binding differs from advertised Git object: ${file}`);
        return entry.sha;
      }
    }
  };
}
function candidateGitProof(candidate) {
  const blobAtPath = gitProofBlob(candidate);
  return (file, bytes) => {
    if (gitObjectSha('blob', bytes) !== blobAtPath(file))
      throw new Error(`Candidate binding differs from advertised Git object: ${file}`);
  };
}

function gpuiSourceBound(evidence, snapshot, repoRoot) {
  try {
    const blobAtPath = gitProofBlob({
      [snapshot.objectType === 'tree' ? 'tree' : 'revision']: snapshot.revision,
      sourceObjectProof: evidence.sourceObjectProof,
    });
    return evidence.paths.every((p) => {
      const blob = blobAtPath(p);
      // Main is a historical source snapshot, not the current checkout. Its
      // portable proof binds regular native blobs without requiring old Git objects.
      if (snapshot.kind === 'main') return Boolean(blob);
      let absolute = repoRoot;
      for (const segment of p.split('/')) {
        absolute = path.join(absolute, segment);
        if (fs.lstatSync(absolute).isSymbolicLink()) return false;
      }
      return (
        fs.lstatSync(absolute).isFile() && gitObjectSha('blob', fs.readFileSync(absolute)) === blob
      );
    });
  } catch {
    return false;
  }
}

function hasGpuiNativeEvidence(row, revision) {
  return (
    Array.isArray(row?.nativeEvidence) &&
    row.nativeEvidence.some(
      (e) =>
        e &&
        typeof e === 'object' &&
        e.result === 'passed' &&
        e.revision === revision &&
        /^[a-f0-9]{40}$/.test(e.revision ?? '') &&
        /^https:\/\//.test(e.source ?? '')
    )
  );
}

function hasGpuiImplementation(row, revision, repoRoot, snapshot) {
  return (
    Array.isArray(row?.blockers) &&
    row.blockers.length === 0 &&
    Array.isArray(row.projectionIdentities) &&
    row.projectionIdentities.length > 0 &&
    Array.isArray(row.implementationEvidence) &&
    row.projectionIdentities.every((identity) =>
      row.implementationEvidence?.some(
        (e) =>
          e &&
          typeof e === 'object' &&
          e.result === 'passed' &&
          e.baseIdentity === row.baseIdentity &&
          e.projectionIdentity === identity &&
          /^[a-f0-9]{40}$/.test(e.revision ?? '') &&
          e.revision === revision &&
          /^https:\/\//.test(e.source ?? '') &&
          Array.isArray(e.paths) &&
          e.paths.length > 0 &&
          e.paths.every(
            (p) =>
              typeof p === 'string' &&
              !path.isAbsolute(p) &&
              !p.split('/').includes('..') &&
              /^(?:native\/gpui\/crates\/[^/]+\/src\/|packages\/adapters\/gpui-peer\/src\/)/.test(p)
          ) &&
          gpuiSourceBound(e, { ...snapshot, revision }, repoRoot)
      )
    )
  );
}

function candidateView(data) {
  const candidate = data.candidateSource;
  const view = {
    ...data,
    candidateSource: undefined,
    prototypeInventory: candidate.prototypeInventory,
    projectionRows: candidate.projectionRows,
    atomicProjectionMapping: candidate.atomicProjectionMapping,
    gpuiCoverageRows: candidate.gpuiCoverageRows,
    packageConsumption: candidate.packageConsumption,
    sourceSnapshot: {
      kind: 'candidate',
      revision: candidate.revision ?? candidate.tree,
      baseMain: candidate.baseMain,
      objectType: candidate.revision ? 'commit' : 'tree',
    },
    counts: { ...data.counts, ...candidate.counts },
  };
  view.comparisonRows = structuredClone(data.comparisonRows).map((row) => {
    const family = subjectFamily(canonicalSubject(row.slug, data.countPolicy.duplicate));
    row.base = view.prototypeInventory.base[family] ?? null;
    const lifecycles = [];
    for (const lib of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
      const f = view.prototypeInventory[lib][family];
      row.projections[lib] = {
        ...row.projections[lib],
        status: f ? `implemented-${f.lifecycle}` : 'not-implemented',
        entityIds: f?.entityIds ?? [],
        sourceFiles: f?.sourceFiles ?? [],
      };
      if (f) lifecycles.push(f.lifecycle);
    }
    row.lifecycle =
      row.base?.lifecycle ??
      (lifecycles.length ? lifecycleOf(lifecycles) : 'not-cataloged-for-this-family');
    return row;
  });
  const baseRows = view.comparisonRows.filter((r) =>
    r.referenceProjects.some((s) => s.project === 'Base UI')
  );
  const shadcnRows = view.comparisonRows.filter((r) =>
    r.referenceProjects.some((s) => s.project === 'shadcn/ui')
  );
  view.counts.baseUiMainCounterparts = baseRows.filter((r) => r.base).length;
  view.counts.baseUiNoMainCounterpart = baseRows.filter((r) => !r.base).length;
  view.counts.shadcnNamedProjections = shadcnRows.filter(
    (r) => r.projections.shadcn.entityIds.length
  ).length;
  view.counts.shadcnDifferenceClassCounts = count(
    shadcnRows.filter((r) => !r.projections.shadcn.entityIds.length).map((r) => r.classification)
  );
  return view;
}

// Refresh only the separately labeled candidate; callers retain the main snapshot.
// This inventories source, never promotes lifecycle or creates acceptance receipts.
export function refreshCandidateSource(data, repoRoot, identity) {
  const catalog = fs
    .readdirSync(path.join(repoRoot, 'spec/prototypes'))
    .filter((p) => /^P-.*\.yaml$/.test(p))
    .map((p) => parseYaml(fs.readFileSync(path.join(repoRoot, 'spec/prototypes', p), 'utf8')));
  const previous = data.candidateSource ?? data;
  const prototypeInventory = {};
  const familyKeys = ['bootstrap-2-3-2', 'brutalist', 'liquid-glass', 'shadcn'];
  for (const lib of Object.keys(data.prototypeInventory)) {
    const sourceFiles = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile() && entry.name.endsWith('.proto.ts'))
          sourceFiles.push(path.relative(repoRoot, file).split(path.sep).join('/'));
      }
    };
    visit(path.join(repoRoot, `packages/prototypes/${lib}/src`));
    prototypeInventory[lib] = {};
    for (const family of [...new Set(sourceFiles.map((p) => p.split('/')[4]))].sort()) {
      const files = sourceFiles
        .filter((p) => p.startsWith(`packages/prototypes/${lib}/src/${family}/`))
        .sort();
      const entities = catalog.filter(
        (e) =>
          e.id.startsWith(`P-${lib.toUpperCase()}-`) &&
          (e.sources ?? []).some((source) => files.includes(source.path))
      );
      const old = previous.prototypeInventory[lib]?.[family];
      const tests = [
        ...new Set([
          ...(old?.tests ?? []),
          ...entities.flatMap((e) =>
            (e.sources ?? [])
              .map((source) => source.path)
              .filter((p) => p.startsWith(`packages/prototypes/${lib}/test/`))
          ),
        ]),
      ]
        .filter((p) => fs.existsSync(path.join(repoRoot, p)))
        .sort();
      prototypeInventory[lib][family] = {
        family,
        entityIds: entities.map((e) => e.id).sort(),
        entityCount: entities.length,
        sourceFiles: files,
        tests,
        lifecycle: lifecycleOf(entities.map((e) => e.status)),
        implementation: 'bounded-source-present',
        freshRuntimeResult: 'not-run',
      };
    }
  }
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const counts = {
    libraryInventory: Object.fromEntries(
      Object.entries(prototypeInventory).map(([lib, families]) => [
        lib,
        {
          families: Object.keys(families).length,
          entities: Object.values(families).reduce((n, f) => n + f.entityIds.length, 0),
          sourceFiles: Object.values(families).reduce((n, f) => n + f.sourceFiles.length, 0),
        },
      ])
    ),
    catalogEntities: catalog.length,
    ...Object.fromEntries(
      LIFECYCLES.map((status) => [
        'catalog' + status[0].toUpperCase() + status.slice(1),
        catalog.filter((e) => e.status === status).length,
      ])
    ),
    familyInstances: Object.values(prototypeInventory).reduce(
      (n, families) => n + Object.keys(families).length,
      0
    ),
    distinctPrototypeSubjects: new Set(
      Object.values(prototypeInventory).flatMap((families) => Object.keys(families))
    ).size,
  };
  const projectionRows = Object.values(prototypeInventory.base).map((base) => ({
    id: `projection.${base.family}`,
    base,
    issue: data.tracker,
    families: Object.fromEntries(
      familyKeys.map((lib) => {
        const f = prototypeInventory[lib][base.family];
        return [
          lib,
          {
            status: f ? `implemented-${f.lifecycle}` : 'required-full-projection-not-implemented',
            reason: f
              ? 'Candidate source present; not current main or full acceptance.'
              : 'Complete four-family atomic coverage remains required.',
            entityIds: f?.entityIds ?? [],
            sourceFiles: f?.sourceFiles ?? [],
            partCount: f?.entityCount ?? 0,
            lifecycle: f?.lifecycle ?? 'none',
            runtimeEvidence: 'not rerun by source refresh',
            nativeMaterial: lib === 'liquid-glass' ? 'not-certified' : 'not-applicable',
          },
        ];
      })
    ),
  }));
  const atomicProjectionMapping = Object.values(prototypeInventory.base)
    .flatMap((f) => f.entityIds)
    .map((baseIdentity) => ({
      baseIdentity,
      projectionCells: Object.fromEntries(
        familyKeys.map((lib) => {
          const ids = Object.values(prototypeInventory[lib])
            .flatMap((f) => f.entityIds)
            .filter((id) =>
              (byId.get(id)?.inherits?.prototypes ?? []).some(
                (p) => (typeof p === 'string' ? p : p.id) === baseIdentity
              )
            );
          return [
            lib,
            {
              mappedCurrentIdentities: ids,
              status: ids.length
                ? `bounded-${lifecycleOf(ids.map((id) => byId.get(id).status))}-mapping-needs-full-acceptance`
                : 'required-missing',
              acceptance: 'unverified',
            },
          ];
        })
      ),
    }));
  const previousGpuiRows = new Map(
    (previous.gpuiCoverageRows ?? []).map((row) => [
      row.baseIdentity + '|' + row.projectionLibrary,
      row,
    ])
  );
  const gpuiCoverageRows = atomicProjectionMapping.flatMap((row) =>
    familyKeys.map((projectionLibrary) => ({
      baseIdentity: row.baseIdentity,
      projectionLibrary,
      projectionIdentities: row.projectionCells[projectionLibrary].mappedCurrentIdentities,
      status: 'required-unassessed',
      meaning:
        'Candidate source reconciliation only; full GPUI capability and native evidence remain required.',
      implementationEvidence: [],
      nativeEvidence: [],
      blockers: [
        ...(previousGpuiRows.get(row.baseIdentity + '|' + projectionLibrary)?.blockers ?? []),
      ],
    }))
  );
  const packageConsumption = Object.fromEntries(
    Object.keys(prototypeInventory).map((lib) => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(repoRoot, `packages/prototypes/${lib}/package.json`), 'utf8')
      );
      return [
        lib,
        {
          name: manifest.name,
          private: manifest.private ?? false,
          version: manifest.version ?? null,
          rootExport: manifest.exports?.['.'] ?? null,
          publication: 'Not asserted by source inventory',
        },
      ];
    })
  );
  const object = identity.revision ?? identity.tree;
  if (Boolean(identity.revision) === Boolean(identity.tree) || !/^[a-f0-9]{40}$/.test(object ?? ''))
    throw new Error('Candidate refresh requires one exact commit or tree');
  const pinned = gitSourceFs(repoRoot, object);
  const sourceBindings = candidateBindingPaths(prototypeInventory, repoRoot).map((p) => {
    const bytes = fs.readFileSync(path.join(repoRoot, p));
    if (
      !pinned.existsSync(path.join(repoRoot, p)) ||
      sha256(pinned.readFileSync(path.join(repoRoot, p))) !== sha256(bytes)
    )
      throw new Error(`Candidate refresh object/worktree drift: ${p}`);
    return { path: p, sha256: sha256(bytes) };
  });
  return {
    kind: 'candidate',
    baseMain: data.protoMain,
    ...identity,
    sourceBindingsObject: object,
    sourceObjectProof: captureGitObjectProof(
      repoRoot,
      object,
      sourceBindings.map((binding) => binding.path)
    ),
    sourceBindings,
    counts,
    prototypeInventory,
    projectionRows,
    atomicProjectionMapping,
    gpuiCoverageRows,
    packageConsumption,
  };
}

export function validate(data, repoRoot = root, candidatePass = false, sourceReader = fs) {
  const errors = [];
  const require = (condition, message) => {
    if (!condition) errors.push(message);
  };
  let sourceFs = sourceReader;
  if (data.candidateSource) {
    try {
      const evidence = data.mainSourceEvidence;
      if (
        evidence?.revision !== data.protoMain ||
        sha256(stableJson(evidence)) !== MAIN_SOURCE_EVIDENCE_DIGESTS[data.protoMain]
      )
        throw new Error('Historical main evidence digest/revision mismatch');
      sourceFs = historicalSourceFs(evidence, repoRoot);
    } catch (error) {
      errors.push(`Pinned main source unavailable: ${error.message}`);
      return errors;
    }
  }
  const rows = data.comparisonRows;
  require(data.schemaVersion === 1, 'Unsupported schema version');
  require(data.tracker === 870, 'Active tracker must be explicit');
  require(new Set(rows.map((r) => r.id)).size === rows.length, 'Duplicate comparison ID');
  const snapshot = sourceSnapshot(data);
  require(/^[a-f0-9]{40}$/.test(data.protoMain ?? '') &&
    /^[a-f0-9]{40}$/.test(snapshot.revision ?? '') &&
    snapshot.kind === (candidatePass ? 'candidate' : 'main') &&
    snapshot.baseMain === data.protoMain &&
    (snapshot.kind !== 'main' ||
      snapshot.revision === data.protoMain), 'Source snapshot revision boundary drift');
  const aliases = { ...SUBJECT_ALIASES, ...data.countPolicy.duplicate };
  require(Object.entries(SUBJECT_ALIASES).every(
    ([key, value]) => aliases[key] === value
  ), 'Comparison alias policy drift');
  const subjects = new Set();
  const referenceUrls = new Set();
  for (const row of rows) {
    const subject = canonicalSubject(row.slug, aliases);
    require(typeof row.slug === 'string' &&
      !subjects.has(subject), `Duplicate comparison subject: ${row.slug}`);
    subjects.add(subject);
    const projects = new Set();
    for (const reference of row.referenceProjects) {
      require(['shadcn/ui', 'Base UI'].includes(reference.project) &&
        !projects.has(reference.project), `Comparison reference project drift: ${row.id}`);
      projects.add(reference.project);
      const source =
        reference.project === 'shadcn/ui'
          ? { repository: 'shadcn-ui/ui', revision: data.referenceSnapshots.shadcn.sha }
          : reference.project === 'Base UI'
            ? { repository: 'mui/base-ui', revision: data.referenceSnapshots.baseUi.sha }
            : null;
      let pin;
      try {
        pin = new URL(reference.pinnedSource);
      } catch {
        /* Invalid URLs fail the check below. */
      }
      const segments = pin?.pathname.split('/').slice(1) ?? [];
      require(Boolean(
        source &&
        pin &&
        pin.origin === 'https://github.com' &&
        !pin.username &&
        !pin.password &&
        !pin.search &&
        !pin.hash &&
        segments.slice(0, 2).join('/') === source.repository &&
        ['blob', 'tree'].includes(segments[2]) &&
        /^[a-f0-9]{40}$/.test(source.revision) &&
        segments[3] === source.revision &&
        segments.length > 4 &&
        segments.slice(4).every(Boolean)
      ), `Reference snapshot pin mismatch: ${row.id}.${reference.project}`);
      for (const field of ['url', 'pinnedSource']) {
        const identity = field + '|' + normalizedUrl(reference[field]);
        require(!referenceUrls.has(identity), `Duplicate comparison reference: ${row.id}.${field}`);
        referenceUrls.add(identity);
      }
    }
  }
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
  require(sh.filter((r) => r.projections.shadcn.entityIds.length > 0).length ===
    data.counts.shadcnNamedProjections, 'Shadcn projection count drift');
  require(equal(
    count(rows.map((r) => r.classification)),
    data.counts.comparisonClassCounts
  ), 'Classification count drift');
  require(equal(
    count(
      sh.filter((r) => r.projections.shadcn.entityIds.length === 0).map((r) => r.classification)
    ),
    data.counts.shadcnDifferenceClassCounts
  ), 'Shadcn difference classification count drift');
  const entities = [];
  const inheritance = new Map();
  const catalog = new Map();
  for (const [lib, families] of Object.entries(data.prototypeInventory)) {
    const values = Object.values(families);
    const n = data.counts.libraryInventory[lib];
    require(values.length === n.families, `${lib} family count drift`);
    require(values.flatMap((f) => f.entityIds).length === n.entities, `${lib} part count drift`);
    const sourcePaths = values.flatMap((f) => f.sourceFiles);
    require(sourcePaths.length === n.sourceFiles, `${lib} source count drift`);
    const actualSourcePaths = [];
    const visit = (directory) => {
      for (const entry of sourceFs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(full);
        else if (entry.isFile() && entry.name.endsWith('.proto.ts'))
          actualSourcePaths.push(path.relative(repoRoot, full).split(path.sep).join('/'));
      }
    };
    visit(path.join(repoRoot, `packages/prototypes/${lib}/src`));
    require(setEqual(sourcePaths, actualSourcePaths), `${lib} source identity set drift`);
    for (const [family, f] of Object.entries(families)) {
      require(f.family === family &&
        f.entityCount ===
          f.entityIds.length, `Inventory family identity/count drift: ${lib}/${family}`);
      require(f.sourceFiles.every((p) =>
        p.startsWith(`packages/prototypes/${lib}/src/${family}/`)
      ), `Inventory source family drift: ${lib}/${family}`);
      for (const id of f.entityIds) {
        entities.push(id);
        if (!/^P-[A-Z0-9-]+$/.test(id)) {
          errors.push(`Invalid entity ID: ${id}`);
          continue;
        }
        const file = path.join(repoRoot, `spec/prototypes/${id}.yaml`);
        require(sourceFs.existsSync(file), `Missing entity: ${id}`);
        if (sourceFs.existsSync(file)) {
          const entity = parseYaml(sourceFs.readFileSync(file, 'utf8'));
          catalog.set(id, entity);
          inheritance.set(
            id,
            (entity.inherits?.prototypes ?? []).map((x) => (typeof x === 'string' ? x : x.id))
          );
          require(entity.id === id &&
            LIFECYCLES.includes(entity.status), `Invalid catalog identity/lifecycle: ${id}`);
          require((entity.sources ?? []).some((source) =>
            f.sourceFiles.includes(source.path)
          ), `Inventory catalog source family mismatch: ${id}`);
        }
      }
      require(f.lifecycle ===
        lifecycleOf(
          f.entityIds.map((id) => catalog.get(id)?.status)
        ), `Inventory lifecycle drift: ${lib}/${family}`);
      for (const p of [...f.sourceFiles, ...f.tests]) {
        if (path.isAbsolute(p) || p.split('/').includes('..')) {
          errors.push(`Unsafe source path: ${p}`);
          continue;
        }
        require(sourceFs.existsSync(path.join(repoRoot, p)), `Missing source: ${p}`);
      }
    }
  }
  require(new Set(entities).size === entities.length, 'Duplicate P identity in inventory');
  require(entities.length === data.counts.catalogEntities, 'Catalog count drift');
  const lifecycleCounts = count([...catalog.values()].map((e) => e.status));
  require(LIFECYCLES.every(
    (status) =>
      (data.counts['catalog' + status[0].toUpperCase() + status.slice(1)] ?? 0) ===
      (lifecycleCounts[status] ?? 0)
  ), 'Snapshot lifecycle totals drift');
  require(data.counts.familyInstances ===
    Object.values(data.prototypeInventory).reduce(
      (n, families) => n + Object.keys(families).length,
      0
    ), 'Inventory family-instance total drift');
  require(data.counts.distinctPrototypeSubjects ===
    new Set(Object.values(data.prototypeInventory).flatMap((families) => Object.keys(families)))
      .size, 'Inventory distinct subject total drift');
  require(setEqual(
    Object.keys(data.packageConsumption ?? {}),
    Object.keys(data.prototypeInventory)
  ), 'Package consumption library set drift');
  for (const [lib, snapshot] of Object.entries(data.packageConsumption ?? {})) {
    if (!Object.hasOwn(data.prototypeInventory, lib)) continue;
    const manifest = JSON.parse(
      sourceFs.readFileSync(path.join(repoRoot, `packages/prototypes/${lib}/package.json`), 'utf8')
    );
    const actual = {
      name: manifest.name,
      private: manifest.private ?? false,
      version: manifest.version ?? null,
      rootExport: manifest.exports?.['.'] ?? null,
    };
    require(Object.entries(actual).every(
      ([key, value]) => stableJson(snapshot[key]) === stableJson(value)
    ), `Package consumption snapshot drift: ${lib}`);
  }
  const familyMatches = (actual, expected) =>
    Boolean(actual && expected) &&
    actual.family === expected.family &&
    actual.entityCount === expected.entityCount &&
    actual.lifecycle === expected.lifecycle &&
    ['entityIds', 'sourceFiles', 'tests'].every((key) =>
      setEqual(actual[key] ?? [], expected[key] ?? [])
    );
  for (const row of rows) {
    const family = subjectFamily(canonicalSubject(row.slug, aliases));
    const expectedBase = data.prototypeInventory.base[family];
    require(expectedBase
      ? familyMatches(row.base, expectedBase)
      : !row.base, `Comparison Base inventory mismatch: ${row.id}`);
    const visibleLifecycles = [];
    for (const lib of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
      const expected = data.prototypeInventory[lib][family];
      const cell = row.projections[lib];
      require(Boolean(cell) &&
        setEqual(cell.entityIds ?? [], expected?.entityIds ?? []) &&
        setEqual(cell.sourceFiles ?? [], expected?.sourceFiles ?? []) &&
        cell.status ===
          (expected
            ? `implemented-${expected.lifecycle}`
            : 'not-implemented'), `Comparison projection inventory mismatch: ${row.id}/${lib}`);
      if (expected)
        visibleLifecycles.push(...expected.entityIds.map((id) => catalog.get(id)?.status));
    }
    require(row.lifecycle ===
      (expectedBase?.lifecycle ??
        (visibleLifecycles.length
          ? lifecycleOf(visibleLifecycles)
          : 'not-cataloged-for-this-family')), `Comparison lifecycle mismatch: ${row.id}`);
  }
  const actualEntities = sourceFs
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
      setEqual(p.base.entityIds, data.prototypeInventory.base[p.base.family]?.entityIds ?? []) &&
      familyMatches(
        p.base,
        data.prototypeInventory.base[p.base.family]
      ), `Projection Base identity mismatch: ${p.id}`);
    for (const lib of familyKeys) {
      const cell = p.families[lib];
      const expected = data.prototypeInventory[lib][p.base.family];
      require(Boolean(cell) &&
        setEqual(cell.entityIds ?? [], expected?.entityIds ?? []) &&
        setEqual(cell.sourceFiles ?? [], expected?.sourceFiles ?? []) &&
        cell.partCount === (expected?.entityIds.length ?? 0) &&
        cell.lifecycle === (expected?.lifecycle ?? 'none') &&
        (expected
          ? cell.status === `implemented-${expected.lifecycle}`
          : ['required-full-projection-not-implemented', 'open-pr-not-main'].includes(
              cell.status
            )), `Projection cell inventory mismatch: ${p.id}/${lib}`);
    }
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
      const cell = r.projectionCells?.[lib];
      require(cell?.status ===
        (expected.length
          ? `bounded-${lifecycleOf(expected.map((id) => catalog.get(id)?.status))}-mapping-needs-full-acceptance`
          : 'required-missing'), `Atomic lifecycle/status drift: ${r.baseIdentity} -> ${lib}`);
      const family = Object.values(data.prototypeInventory.base).find((f) =>
        f.entityIds.includes(r.baseIdentity)
      );
      const projection = data.projectionRows.find((p) => p.base.family === family?.family)
        ?.families?.[lib];
      require(actual.every((id) =>
        projection?.entityIds?.includes(id)
      ), `Projection cell atomic mapping mismatch: ${r.baseIdentity} -> ${lib}`);
    }
  }
  const gpuiRows = data.gpuiCoverageRows ?? [];
  require(setEqual(
    gpuiRows.map((r) => r.baseIdentity + '|' + r.projectionLibrary),
    baseIds.flatMap((id) => familyKeys.map((lib) => id + '|' + lib))
  ), 'Required GPUI atomic/family set drift');
  for (const row of gpuiRows)
    require(setEqual(
      row.projectionIdentities ?? [],
      mapping.find((x) => x.baseIdentity === row.baseIdentity)?.projectionCells?.[
        row.projectionLibrary
      ]?.mappedCurrentIdentities ?? []
    ), `GPUI projection identity drift: ${row.baseIdentity}/${row.projectionLibrary}`);
  for (const row of gpuiRows) {
    if (row.status === 'verified') {
      require(hasGpuiImplementation(
        row,
        snapshot.revision,
        repoRoot,
        snapshot
      ), `Incomplete GPUI implementation: ${row.baseIdentity}/${row.projectionLibrary}`);
      require(hasGpuiNativeEvidence(
        row,
        snapshot.revision
      ), `Incomplete GPUI acceptance: ${row.baseIdentity}/${row.projectionLibrary}`);
    }
  }
  require(setEqual(
    Object.keys(data.counts.consumerPrograms),
    Object.keys(CONSUMER_LEDGERS)
  ), 'Consumer program configuration drift');
  for (const row of data.consumerRows) {
    require(Object.hasOwn(
      CONSUMER_LEDGERS,
      row.program
    ), `Consumer program outside configured ledgers: ${row.ID}`);
    require(row.source === CONSUMER_LEDGERS[row.program], `Consumer ledger mismatch: ${row.ID}`);
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
  for (const [program, ledger] of Object.entries(CONSUMER_LEDGERS)) {
    const summary = data.counts.consumerPrograms[program];
    if (!summary) continue;
    const actual = data.consumerRows.filter((r) => r.program === program);
    require(actual.length === summary.rows &&
      equal(
        count(actual.map((r) => r.State)),
        summary.states
      ), `Consumer totals drift: ${program}`);
    const source = fs.readFileSync(path.join(repoRoot, ledger), 'utf8');
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
  const planSource = data.candidateSource ?? data;
  const planSnapshot = data.candidateSource ? sourceSnapshot(candidateView(data)) : snapshot;
  const planBaseIds = Object.values(planSource.prototypeInventory.base).flatMap((f) => f.entityIds);
  const planMapping = planSource.atomicProjectionMapping ?? [];
  const planGpuiRows = planSource.gpuiCoverageRows ?? [];
  const plan = data.deliveryPlan;
  require(Boolean(plan) && plan.items.length === plan.coreTodoCount, 'Finf task count drift');
  if (plan) {
    require(plan.gpuiParity?.required === true &&
      plan.gpuiParity?.requiredDimension === 9, 'GPUI same-capability scope must remain required');
    require(setEqual(
      plan.items.map((x) => x.id),
      FINF_CORE_ITEM_IDS
    ), 'Finf required item scope drift or duplicates');
    require(new Set(plan.priorWork.map((x) => x.pr)).size === plan.priorWork.length &&
      plan.priorWork.every((x) => x.id === `prior-pr.${x.pr}`), 'Finf prior work identity drift');
    require(setEqual(
      plan.priorWork.map((x) => x.pr),
      FINF_REQUIRED_PRIOR_PRS
    ), 'Finf required prior work set drift');
    require(plan.initialTodoCount ===
      plan.coreTodoCount + plan.priorWorkRoutingCount, 'Finf initial task count drift');
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
      if (item.id.startsWith('baseline.'))
        require(setEqual(
          item.baseEntityIds ?? [],
          planSource.prototypeInventory.base[item.id.slice('baseline.'.length)]?.entityIds ?? []
        ), `Finf baseline Base scope drift: ${item.id}`);
      const subject = item.id.split('.').slice(1).join('.');
      const scopeFamilies =
        item.id === 'repair.overlay-scrollbar-coordinate'
          ? OVERLAY_BASE_FAMILIES.filter((family) => planSource.prototypeInventory.base[family])
          : [subject];
      const subjectBaseIds = scopeFamilies.flatMap(
        (family) => planSource.prototypeInventory.base[family]?.entityIds ?? []
      );
      if (item.complete || item.baseEntityIds !== undefined)
        require((!item.complete || subjectBaseIds.length > 0) &&
          setEqual(
            item.baseEntityIds ?? [],
            subjectBaseIds
          ), `Finf subject Base scope drift: ${item.id}`);
      if (item.complete) {
        const requiredBaseIds = item.baseEntityIds ?? [];
        require(requiredBaseIds.length > 0 &&
          new Set(requiredBaseIds).size === requiredBaseIds.length &&
          requiredBaseIds.every((id) =>
            planBaseIds.includes(id)
          ), `Incomplete Finf Base scope: ${item.id}`);
        for (const id of requiredBaseIds)
          for (const lib of familyKeys) {
            const cell = planMapping.find((r) => r.baseIdentity === id)?.projectionCells?.[lib];
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
        for (const id of requiredBaseIds)
          for (const lib of familyKeys) {
            const gpui = planGpuiRows.find(
              (r) => r.baseIdentity === id && r.projectionLibrary === lib
            );
            require(hasGpuiImplementation(
              gpui,
              item.acceptedRevision,
              repoRoot,
              planSnapshot
            ), `Incomplete GPUI implementation: ${item.id} -> ${id}/${lib}`);
            require(gpui?.status === 'verified' &&
              hasGpuiNativeEvidence(
                gpui,
                item.acceptedRevision
              ), `Incomplete GPUI acceptance: ${item.id} -> ${id}/${lib}`);
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
  if (data.candidateSource) {
    const candidate = data.candidateSource;
    require(candidate.baseMain === data.protoMain &&
      candidate.kind === 'candidate' &&
      Boolean(candidate.revision) !== Boolean(candidate.tree) &&
      /^[a-f0-9]{40}$/.test(
        candidate.revision ?? candidate.tree ?? ''
      ), 'Candidate source revision boundary drift');
    require(setEqual(Object.keys(candidate.counts), [
      'libraryInventory',
      'catalogEntities',
      'catalogDraft',
      'catalogActive',
      'catalogDeprecated',
      'catalogRemoved',
      'familyInstances',
      'distinctPrototypeSubjects',
    ]), 'Candidate inventory count scope drift');
    try {
      const object = candidate.revision ?? candidate.tree;
      require(candidate.sourceBindingsObject === object, 'Candidate source binding revision drift');
      const proveBlob = candidateGitProof(candidate);
      const expectedPaths = candidateBindingPaths(candidate.prototypeInventory, repoRoot);
      const bindings = candidate.sourceBindings ?? [];
      require(setEqual(
        bindings.map((entry) => entry.path),
        expectedPaths
      ), 'Candidate source binding path set drift');
      for (const binding of bindings) {
        const p = binding.path;
        if (path.isAbsolute(p) || p.split('/').includes('..')) {
          errors.push(`Unsafe candidate source path: ${p}`);
          continue;
        }
        const absolute = path.join(repoRoot, p);
        const bytes = fs.existsSync(absolute) ? fs.readFileSync(absolute) : undefined;
        require(/^[a-f0-9]{64}$/.test(binding.sha256 ?? '') &&
          bytes !== undefined &&
          sha256(bytes) === binding.sha256, `Candidate source binding/worktree drift: ${p}`);
        if (bytes !== undefined) proveBlob(p, bytes);
      }
      errors.push(
        ...validate(candidateView(data), repoRoot, true).map((error) => `Candidate: ${error}`)
      );
    } catch (error) {
      errors.push(`Candidate source cannot be validated: ${error.message}`);
    }
  }
  return errors;
}
export function renderPlan(d) {
  const p = d.deliveryPlan;
  const current = d.candidateSource ?? d;
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
      '## Cross-matrix safe-area and spacing acceptance',
      p.layoutAudit.scope + '. ' + p.layoutAudit.rule,
      ...p.layoutAudit.specificDialogAcceptance.map((x) => '- Dialog acceptance: ' + x),
      '## Homepage exhibition and eligibility',
      ...(p.homepageAdmission?.requirements ?? []).map((x) => '- [ ] ' + x),
      'Source-stage additions do not establish homepage eligibility. No unfinished family or Web-only substitute is enabled as an accepted native Runtime.',
      '## GPUI same-capability delivery',
      p.gpuiParity.scope + '. ' + p.gpuiParity.currentBoundary,
      p.gpuiParity.material,
      `The structured ledger has ${current.gpuiCoverageRows.length} required GPUI Base-identity × design-family cells. They remain unassessed/pending until exact implementation and native evidence are mapped; existing code is not erased and missing code is not marked not-applicable.`,
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
          ...(x.complete && x.closeout
            ? [
                `Accepted closeout for **${x.id}**: ${x.closeout.mode}; source head ${x.closeout.sourceHead}; integration revision ${x.closeout.integrationRevision}; [evidence](${x.closeout.evidence}); [independent review](${x.closeout.independentReview.source}).`,
              ]
            : []),
          ...x.mandatoryUnfinishedCriteria.map(
            (c) =>
              `- **${c.id}** (${x.complete && x.closeout ? 'accepted closeout' : 'unmet'}): ${c.acceptance} [source](${c.source})`
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
        current.atomicProjectionMapping.map((x) => [
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
  const snapshot = sourceSnapshot(d);
  const source = (p) =>
    `[${p}](https://github.com/Proto-UI/Proto-UI/blob/${snapshot.revision}/${p})`;
  const c = d.counts;
  const t = (s) => s.replaceAll('-', ' ');
  const sections = [
    '# Active prototype comparison and four-family projection matrix',
    `Status: non-normative operational inventory. Tracker: ${issue(d.tracker)}. Observed ${d.observedAt}; Proto UI main baseline \`${d.protoMain}\`; source inventory ${snapshot.kind} \`${snapshot.revision}\`${snapshot.kind === 'candidate' ? ' (candidate-only implementation, not current main)' : ''}. This replaces #377 as the active matrix entry without closing existing implementation or consumer trackers. Generated from [the structured matrix](prototype-coverage-matrix.json) by \`node scripts/coverage-matrices/prototype-coverage.mjs --write\`.`,
    '## Independent project and counting boundary',
    d.referencePolicy,
    'A comparison difference alone is not a defect or a new Base obligation. The maintainer has separately selected the complete Finf groups 1–6, all four projections and the Overlay regression as explicit project-owned work. `candidate-needs-independent-admission` means research, not approval. Existing historical `UPSTREAM-*` reference IDs retain source identity only; this document neither renames them nor grants another project authority. Actual technical dependencies and licenses remain unchanged.',
    'A family is one subject, not the sum of Root/Trigger/Content parts. A P identity is a cataloged part or projection, not an unrelated component. Direct/asHook authoring entries share one protocol; Transition therefore has two source files but one part. Generated Lucide glyphs share one Icon protocol. Framework repetitions and private application compositions are separate inventories.',
    table(
      ['Library', 'Families', 'P identities', 'Source definitions'],
      Object.entries(c.libraryInventory).map(([k, v]) => [k, v.families, v.entities, v.sourceFiles])
    ),
    `Total: **${c.familyInstances} library-family instances; ${c.distinctPrototypeSubjects} distinct subjects; ${c.catalogEntities} P identities; ${LIFECYCLES.map((status) => `${c['catalog' + status[0].toUpperCase() + status.slice(1)] ?? 0} ${status}`).join(' / ')} P identities**. This is an implementation inventory, not zero usable code and not a count of mature components. The private ChatUI Message/Code Block compositions add 6/3 package-local parts but no public P identities.`,
    ...(d.candidateSource
      ? [
          '## Separate candidate source inventory',
          `Candidate ${d.candidateSource.revision ? 'commit' : 'local tree'} ${d.candidateSource.revision ?? d.candidateSource.tree}; based on main ${d.candidateSource.baseMain}. These source counts are candidate-only; offline Git commit/tree proofs bind every stored path to the advertised object and the current worktree. The historical main snapshot is checked against its fixed evidence digest without requiring historical Git objects. These records do not change any pinned-main comparison denominator, mark work accepted, or establish current-main availability.`,
          table(
            ['Library', 'Main families / identities', 'Candidate families / identities'],
            Object.entries(d.candidateSource.counts.libraryInventory).map(([lib, value]) => [
              lib,
              `${c.libraryInventory[lib].families} / ${c.libraryInventory[lib].entities}`,
              `${value.families} / ${value.entities}`,
            ])
          ),
          `Candidate atomic GPUI obligations: ${d.candidateSource.gpuiCoverageRows.length}; see the complete checklist. Source presence does not satisfy runtime, lifecycle, GPUI or independent acceptance gates.`,
        ]
      : []),
    '## Reference sets and difference accounting',
    table(
      ['Comparison source', 'Pinned evidence', 'Denominator', 'Main counterpart'],
      [
        [
          '[shadcn/ui directory](https://ui.shadcn.com/docs/components)',
          d.referenceSnapshots.shadcn.sha,
          `${d.referenceSnapshots.shadcn.directoryCount} directory subjects`,
          `${c.shadcnNamedProjections} named Shadcn projections; see catalog lifecycle below`,
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
        'Pinned source implementation',
        'Ownership / remaining boundary',
        'Consumer row IDs',
        'Existing work',
      ],
      d.comparisonRows.map((r) => [
        r.referenceProjects
          .map((s) => `[${s.label}](${s.url}) ([pin](${s.pinnedSource}))`)
          .join('; '),
        `${r.classification}; ${r.decision}`,
        `${r.mainStatus}${r.base ? '; ' + r.base.entityIds.map((id) => `[${id}](https://github.com/Proto-UI/Proto-UI/blob/${snapshot.revision}/spec/prototypes/${id}.yaml)`).join(', ') : ''}`,
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
    table(
      ['Library / package', 'Private', 'Version', 'Root export', 'Publication evidence'],
      Object.entries(d.packageConsumption).map(([lib, pkg]) => [
        `${lib}: ${pkg.name}`,
        String(pkg.private),
        pkg.version ?? 'not declared',
        JSON.stringify(pkg.rootExport),
        pkg.publication,
      ])
    ),
    'These manifest facts describe the selected source revision and do not prove registry publication or a successful consumer install. Four-family implementation and runtime/visual parity remain required in Finf; private package status is not a waiver. Changing release identity/publication requires its own explicit release authorization.',
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
