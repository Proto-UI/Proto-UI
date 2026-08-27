import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import {
  MATRIX_CONFIGS,
  collectCoverageMatrixIssues,
  validateCoverageMatrices,
} from '../check-coverage-matrices.mjs';

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function createRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ui-coverage-matrices-'));
  const catalogRoot = path.join(root, 'spec', 'fixtures');
  fs.mkdirSync(catalogRoot, { recursive: true });
  for (const [id, status] of [
    ['P-BASE-BUTTON', 'draft'],
    ['P-BASE-SCROLL-AREA', 'draft'],
    ['A-WEB-COMPONENT-0001', 'active'],
    ['A-REACT-18-19-0001', 'active'],
  ]) {
    fs.writeFileSync(
      path.join(catalogRoot, `${id}.yaml`),
      `id: ${id}\ntype: fixture\nstatus: ${status}\n`,
      'utf8'
    );
  }
  temporaryRoots.push(root);
  return root;
}

function separator(headers) {
  return `| ${headers.map(() => '---').join(' | ')} |`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    separator(headers),
    ...rows.map((row) => `| ${headers.map((header) => row[header] ?? '—').join(' | ')} |`),
  ].join('\n');
}

function totals(config, rows) {
  const counts = new Map(config.allowedStates.map((state) => [state, 0]));
  for (const row of rows) counts.set(row.State, (counts.get(row.State) ?? 0) + 1);
  return [
    '## State totals',
    '',
    '| State | Count |',
    '| --- | --- |',
    ...config.allowedStates.map((state) => `| ${state} | ${counts.get(state)} |`),
  ].join('\n');
}

function targetClassTotals(config, rows) {
  const counts = new Map(config.allowedTargetClasses.map((targetClass) => [targetClass, 0]));
  for (const row of rows) {
    counts.set(row['Target class'], (counts.get(row['Target class']) ?? 0) + 1);
  }
  return [
    '## Target-class totals',
    '',
    '| Target class | Count |',
    '| --- | --- |',
    ...config.allowedTargetClasses.map(
      (targetClass) => `| ${targetClass} | ${counts.get(targetClass)} |`
    ),
  ].join('\n');
}

function validWebsiteRow(overrides = {}) {
  return {
    ID: 'www.shell.search',
    Path: 'apps/www/src/components/override/Search.astro',
    'User job': 'Search documentation',
    'Current owner': 'Website team',
    'Target class': 'official-prototype',
    'Proto UI chain': 'P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'Prototype is draft; Adapter profile is active',
    'WC host and SSR/no-JS strategy':
      'WC: generated facade; SSR: meaningful light DOM; no-JS: native search link remains',
    'Dependency and owner': 'No blocker; owner: website team',
    Difficulty: 'F3',
    Milestone: 'M2',
    State: 'ready',
    Evidence: 'apps/www/src/components/override/Search.astro',
    'Escape or exemption': '—',
    'Re-review or removal issue': '—',
    ...overrides,
  };
}

function validHarnessRow(overrides = {}) {
  return {
    ID: 'harness.transcript.viewport',
    Path: 'apps/agent-harness/src/transcript/TranscriptViewport.tsx',
    'User job': 'Read a transcript',
    'Current owner': 'Harness application',
    'Target owner': 'Proto UI Scroll Area composition',
    'Target class': 'composition',
    'Proto UI chain': 'P-BASE-SCROLL-AREA draft; A-REACT-18-19-0001 active',
    'App state and semantic events':
      'App state: message IDs and ordering; Events: jumpToLatestRequest',
    'Production host and equivalence evidence':
      'Host: React 19; WC: required fixture; React: production; Vue: required fixture',
    'Dependency and owner': '#519; owner: scroll domain',
    Difficulty: 'F5',
    Milestone: 'M2',
    State: 'research',
    Evidence: '#519 acceptance and baseline plan',
    'Escape or exemption': '—',
    'Re-review or removal issue': '—',
    ...overrides,
  };
}

function writeMatrix(
  root,
  config,
  rows,
  { headers = config.headers, totalsText, targetClassTotalsText, extraText = '' } = {}
) {
  const absolutePath = path.join(root, config.relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      '# Fixture matrix',
      '',
      config.startMarker,
      table(headers, rows),
      '<!-- coverage-matrix:end -->',
      '',
      totalsText ?? totals(config, rows),
      '',
      config.kind === 'agent-harness'
        ? (targetClassTotalsText ?? targetClassTotals(config, rows))
        : '',
      '',
      extraText,
      '',
    ].join('\n'),
    'utf8'
  );
}

function rowsWithRequiredIds(config, primaryRow, rowFactory) {
  const requiredIds = [
    ...(config.requiredIds ?? []),
    ...(config.inheritedSurfaceManifests ?? []).flatMap((manifest) => manifest.ids),
  ];
  return [
    primaryRow,
    ...requiredIds.filter((id) => id !== primaryRow.ID).map((id) => rowFactory({ ID: id })),
  ];
}

function writeValidMatrices(root, websiteOverrides = {}, harnessOverrides = {}) {
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(websiteOverrides), validWebsiteRow)
  );
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(harnessOverrides), validHarnessRow)
  );
}

function validationMessage(root) {
  let caught;
  try {
    validateCoverageMatrices({ rootDir: root });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, 'expected coverage matrix validation to fail');
  return caught.message;
}

test('accepts both matrices with exact headers, policies, and matching totals', () => {
  const root = createRoot();
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects omission of required inherited and parent-named inventory surfaces', () => {
  const root = createRoot();
  writeMatrix(root, MATRIX_CONFIGS[0], [validWebsiteRow()]);
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  const message = validationMessage(root);
  assert.match(message, /required inventory surface ID `www\.shell\.skip-link` is missing/);
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.mobile-table-of-contents` is missing/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.mobile-menu-toggle` is missing from inherited manifest @astrojs\/starlight@0\.35\.3/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.sidebar-navigation` is missing from inherited manifest @astrojs\/starlight@0\.35\.3/
  );
  assert.match(
    message,
    /required inventory surface ID `harness\.workspace\.branch-checkpoints` is missing/
  );
});

test('rejects an interactive website source that is not bound to the matrix', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'NewControl.astro');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    '<button>New</button><script>addEventListener("click", () => {})</script>'
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/NewControl\.astro` is not bound/
  );
});

test('does not accept a prose path mention as an interactive source binding', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const websiteRows = rowsWithRequiredIds(website, validWebsiteRow(), validWebsiteRow);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'scripts', 'NewControl.ts');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'addEventListener("click", () => {})');
  writeMatrix(root, website, websiteRows, {
    extraText: 'A prose note mentions apps/www/src/scripts/NewControl.ts but assigns no row.',
  });
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/scripts\/NewControl\.ts` is not bound/
  );
});

test('rejects uncataloged entity IDs and stale lifecycle reporting', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'P-NOT-REAL; P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'Adapter profile is active',
  });
  const message = validationMessage(root);
  assert.match(message, /references uncataloged entity ID `P-NOT-REAL`/);
  assert.match(message, /Lifecycle must report catalog status `draft`/);
});

test('reports both required files with actionable markers when they are missing', () => {
  const issues = collectCoverageMatrixIssues({ rootDir: createRoot() });
  assert.equal(issues.length, 2);
  assert.match(issues[0], /internal\/website\/self-hosting-coverage-matrix\.md: file is missing/);
  assert.match(issues[0], /coverage-matrix:start website/);
  assert.match(issues[1], /internal\/agent-harness\/dogfood-coverage-matrix\.md: file is missing/);
  assert.match(issues[1], /coverage-matrix:start agent-harness/);
});

test('rejects a reordered or renamed main-table header', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const badHeaders = [...website.headers];
  badHeaders[2] = 'Job';
  writeMatrix(root, website, [validWebsiteRow()], { headers: badHeaders });
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  assert.match(validationMessage(root), /header mismatch; expected exactly/);
});

test('rejects unstable and duplicate IDs plus unsupported classifications', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const rows = [
    validWebsiteRow({ ID: 'Search', 'Target class': 'unknown', State: 'unclassified' }),
    validWebsiteRow({ ID: 'Search' }),
  ];
  writeMatrix(root, website, rows);
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  const message = validationMessage(root);
  assert.match(message, /unstable ID/);
  assert.match(message, /duplicate ID/);
  assert.match(message, /must not contain unknown or unclassified/);
  assert.match(message, /unsupported Target class/);
  assert.match(message, /unsupported State/);
});

test('requires an issue for every blocked or research row', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { 'Dependency and owner': 'Harness team' });
  assert.match(validationMessage(root), /research rows must link a dependency as #<issue>/);
});

test('requires reasons and re-review triggers for native and infrastructure exemptions', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Escape or exemption': '—',
    'Re-review or removal issue': '—',
  });
  const message = validationMessage(root);
  assert.match(message, /must state a reason in Escape or exemption/);
  assert.match(message, /must state a re-review trigger/);
});

test('requires a removal issue for a temporary escape', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Escape or exemption': 'Temporary raw Adapter import',
    'Re-review or removal issue': 'Remove after migration',
  });
  assert.match(validationMessage(root), /temporary escapes must link their removal as #<issue>/);
});

test('requires website and Harness policy labels on every row', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    { 'WC host and SSR/no-JS strategy': 'generated facade' },
    {
      'App state and semantic events': 'message IDs',
      'Production host and equivalence evidence': 'React production',
    }
  );
  const message = validationMessage(root);
  for (const label of [
    'WC:',
    'SSR:',
    'no-JS:',
    'App state:',
    'Events:',
    'Host:',
    'React:',
    'Vue:',
  ]) {
    assert.ok(message.includes(`missing required \`${label}\` label`));
  }
});

test('requires owner and evidence cells to name concrete ownership and evidence', () => {
  const root = createRoot();
  writeValidMatrices(root, { 'Current owner': '—', Evidence: 'TBD' });
  const message = validationMessage(root);
  assert.match(message, /Current owner must name an owner/);
  assert.match(message, /Evidence must name a baseline, executable check, or evidence path/);
});

test('rejects stale explicit website paths and terminal class/state mismatches', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    Path: '`apps/www/src/components/Missing.astro`',
    'Target class': 'native/static',
    State: 'ready',
    'Escape or exemption': 'Native anchor needs no protocol owner',
    'Re-review or removal issue': '#420',
  });
  const message = validationMessage(root);
  assert.match(message, /Path references missing repository path/);
  assert.match(message, /Target class `native\/static` requires State `native\/static`/);
});

test('allows an app-local prototype row to advance to dogfooded with implementation evidence', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Evidence: 'apps/agent-harness/test/tool-invocation.browser.test.ts',
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects totals that omit a state or disagree with matrix rows', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const rows = [validWebsiteRow()];
  const badTotals = [
    '## State totals',
    '',
    '| State | Count |',
    '| --- | --- |',
    '| self-hosted | 0 |',
    '| ready | 0 |',
    '| research | 0 |',
    '| blocked | 0 |',
    '| native/static | 0 |',
  ].join('\n');
  writeMatrix(root, website, rows, { totalsText: badTotals });
  writeMatrix(root, MATRIX_CONFIGS[1], [validHarnessRow()]);
  const message = validationMessage(root);
  assert.match(message, /declares ready=0, but the matrix contains 1/);
  assert.match(message, /State totals is missing `infrastructure-exempt`/);
});

test('rejects Harness target-class totals that disagree with matrix rows', () => {
  const root = createRoot();
  const harness = MATRIX_CONFIGS[1];
  const harnessRows = rowsWithRequiredIds(harness, validHarnessRow(), validHarnessRow);
  const compositionCount = harnessRows.filter(
    (row) => row['Target class'] === 'composition'
  ).length;
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(), validWebsiteRow)
  );
  writeMatrix(root, harness, harnessRows, {
    targetClassTotalsText: targetClassTotals(harness, harnessRows).replace(
      `| composition | ${compositionCount} |`,
      `| composition | ${compositionCount - 1} |`
    ),
  });
  assert.ok(
    validationMessage(root).includes(
      `Target-class totals declares composition=${compositionCount - 1}, but the matrix contains ${compositionCount}`
    )
  );
});

test('accepts an optional Total row and verifies it against the matrix size', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const websiteRows = rowsWithRequiredIds(website, validWebsiteRow(), validWebsiteRow);
  const harnessRows = rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow);
  const websiteTotals = `${totals(website, websiteRows)}\n| Total | ${websiteRows.length + 1} |`;
  writeMatrix(root, website, websiteRows, { totalsText: websiteTotals });
  writeMatrix(root, MATRIX_CONFIGS[1], harnessRows);
  assert.match(
    validationMessage(root),
    new RegExp(
      `declares Total=${websiteRows.length + 1}, but the matrix contains ${websiteRows.length} rows`
    )
  );

  const correctedRoot = createRoot();
  writeMatrix(correctedRoot, website, websiteRows, {
    totalsText: `${totals(website, websiteRows)}\n| Total | ${websiteRows.length} |`,
  });
  writeMatrix(correctedRoot, MATRIX_CONFIGS[1], harnessRows);
  assert.deepEqual(validateCoverageMatrices({ rootDir: correctedRoot }), { matrixCount: 2 });
});
