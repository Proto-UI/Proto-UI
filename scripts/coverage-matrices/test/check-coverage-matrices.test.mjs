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
    ['P-ACTIVE-BUTTON', 'active'],
    ['P-BASE-BUTTON', 'draft'],
    ['P-BASE-SCROLL-AREA', 'draft'],
    ['P-REMOVED-BUTTON', 'removed'],
    ['A-WEB-COMPONENT-0001', 'active'],
    ['A-REACT-18-19-0001', 'active'],
    ['A-VUE-3-0001', 'active'],
    ['A-VUE-2-0001', 'active'],
  ]) {
    fs.writeFileSync(
      path.join(catalogRoot, `${id}.yaml`),
      `id: ${id}\ntype: fixture\nstatus: ${status}\n`,
      'utf8'
    );
  }
  for (const config of MATRIX_CONFIGS) {
    for (const repositoryPath of Object.values(config.requiredRepositoryPathsByRow ?? {}).flat()) {
      const absolutePath = path.join(root, repositoryPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      if (!fs.existsSync(absolutePath)) fs.writeFileSync(absolutePath, '', 'utf8');
    }
  }
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    `lockfileVersion: '9.0'
importers:
  apps/www:
    dependencies:
      '@astrojs/starlight':
        specifier: ^0.35.2
        version: 0.35.3(astro@5.18.1)
packages:
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/plugin-frames@0.41.7': {}
snapshots:
  '@astrojs/starlight@0.35.3(astro@5.18.1)':
    dependencies:
      astro-expressive-code: 0.41.7(astro@5.18.1)
  'astro-expressive-code@0.41.7(astro@5.18.1)':
    dependencies:
      rehype-expressive-code: 0.41.7
  'rehype-expressive-code@0.41.7':
    dependencies:
      expressive-code: 0.41.7
  'expressive-code@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
      '@expressive-code/plugin-frames': 0.41.7
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/plugin-frames@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
`,
    'utf8'
  );
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
    'Proto UI chain': 'P-ACTIVE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'P-ACTIVE-BUTTON=active; A-WEB-COMPONENT-0001=active',
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
  const nonInteractiveEntries = new Map(
    (config.nonInteractiveSurfaceManifests ?? []).flatMap((manifest) =>
      manifest.entries.map((entry) => [entry.id, entry])
    )
  );
  const requiredIds = new Set([
    ...(config.requiredIds ?? []),
    ...Object.keys(config.requiredCatalogIdsByRow ?? {}),
    ...Object.keys(config.requiredRepositoryPathsByRow ?? {}),
    ...(config.inheritedSurfaceManifests ?? []).flatMap((manifest) => manifest.ids),
    ...nonInteractiveEntries.keys(),
  ]);
  return [
    primaryRow,
    ...[...requiredIds]
      .filter((id) => id !== primaryRow.ID)
      .map((id) => {
        const requiredCatalogIds = config.requiredCatalogIdsByRow?.[id] ?? [];
        const requiredRepositoryPaths = config.requiredRepositoryPathsByRow?.[id] ?? [];
        const nonInteractiveExpectation = nonInteractiveEntries.get(id);
        return rowFactory({
          ID: id,
          ...(nonInteractiveExpectation
            ? {
                'Target class': nonInteractiveExpectation.targetClass,
                State: nonInteractiveExpectation.state,
                ...(nonInteractiveExpectation.targetClass === 'native/static'
                  ? {
                      'Proto UI chain': 'Native semantic HTML',
                      Lifecycle: 'Native HTML; no catalog entity required',
                      'Dependency and owner': 'No Proto UI dependency; owner: website team',
                      'Escape or exemption':
                        'Reason: native semantic HTML owns the complete information path',
                      'Re-review or removal issue': '#420 if app-owned interaction is introduced',
                    }
                  : {}),
                ...(nonInteractiveExpectation.state === 'blocked' ||
                nonInteractiveExpectation.state === 'research'
                  ? { 'Dependency and owner': '#420; owner: website team' }
                  : {}),
                ...(nonInteractiveExpectation.targetClass === 'infrastructure-exempt'
                  ? {
                      'Proto UI chain': 'Website-owned static presentation infrastructure',
                      Lifecycle: 'No catalog entity required',
                      'Dependency and owner': 'owner: website team',
                      'Escape or exemption':
                        'Reason: static styling remains bounded website presentation infrastructure',
                      'Re-review or removal issue':
                        '#420 if the projection gains interaction or semantic state',
                    }
                  : {}),
              }
            : {}),
          ...(requiredCatalogIds.length > 0
            ? {
                'Proto UI chain': requiredCatalogIds.join('; '),
                Lifecycle: requiredCatalogIds.map((entry) => `${entry}=active`).join('; '),
                ...(config.kind === 'website' &&
                requiredCatalogIds.every((entry) => !/^(?:P|M)-/.test(entry))
                  ? {
                      State: 'research',
                      'Dependency and owner': '#420; owner: website team',
                    }
                  : {}),
              }
            : {}),
          ...(requiredRepositoryPaths.length > 0
            ? {
                Path: requiredRepositoryPaths.map((entry) => `\`${entry}\``).join(', '),
                Evidence: `${requiredRepositoryPaths
                  .map((entry) => `\`${entry}\``)
                  .join(', ')} source baseline`,
              }
            : {}),
        });
      }),
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

test('keeps non-interactive path and class/state manifest IDs identical', () => {
  const websiteConfig = MATRIX_CONFIGS.find((config) => config.kind === 'website');
  const pathIds = Object.keys(websiteConfig.requiredRepositoryPathsByRow).sort();
  const expectationIds = websiteConfig.nonInteractiveSurfaceManifests
    .flatMap((manifest) => manifest.entries.map((entry) => entry.id))
    .sort();
  assert.deepEqual(pathIds, expectationIds);
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
    /required inventory surface ID `www\.shell\.site-title` is missing from non-interactive manifest repository-owned non-interactive website projections/
  );
  assert.match(
    message,
    /required inventory surface ID `www\.shell\.social-links` is missing from non-interactive manifest/
  );
  assert.match(message, /required inventory surface ID `www\.docs\.phase-badge` is missing/);
  assert.match(message, /required inventory surface ID `www\.icons\.static-lucide` is missing/);
  assert.match(
    message,
    /required inventory surface ID `www\.demo\.raw-adapter-runtimes` is missing/
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

test('includes interactive authored demo controllers in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'demo-new-control.demo.ts'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'host.addEventListener("click", () => api.call("demo", "open"));');
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/demo-new-control\.demo\.ts` is not bound/
  );
});

test('detects camel-cased JSX event handler props in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'NewControl.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'export const NewControl = () => <button onClick={() => {}} />;');
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/NewControl\.tsx` is not bound/
  );
});

test('detects form submission handlers in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'NewForm.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'export const NewForm = () => <form onSubmit={() => {}} />;');
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/NewForm\.tsx` is not bound/
  );
});

test('detects JSX interaction handlers without an event-name allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const handler of ['onBlur', 'onFocus', 'onDoubleClick', 'onMouseDown']) {
    const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', `${handler}Control.tsx`);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `export const Control = () => <button ${handler}={() => {}} />;`);
  }
  const message = validationMessage(root);
  for (const handler of ['onBlur', 'onFocus', 'onDoubleClick', 'onMouseDown']) {
    assert.ok(
      message.includes(
        `interactive website source \`apps/www/src/components/${handler}Control.tsx\` is not bound`
      )
    );
  }
});

test('does not confuse comparisons and ordinary onXxx variables with JSX handlers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'comparison.tsx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      'const a = 1;',
      'const b = 2;',
      'const lower = a < b;',
      'let onDoubleClick = () => {};',
      'export const result = lower ? onDoubleClick : undefined;',
    ].join('\n')
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not treat JSX-looking TypeScript strings as executable handlers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [fileName, content] of [
    [
      'single-quoted-example.ts',
      "export const example = '<button onDoubleClick={handler}>Example</button>';",
    ],
    ['template-example.tsx', 'export const example = `<button onBlur={handler}>Example</button>`;'],
  ]) {
    const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', fileName);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not treat JSX-looking Astro frontmatter strings as template handlers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [fileName, declaration] of [
    [
      'single-quoted-example.astro',
      "const example = '<button onDoubleClick={handler}>Example</button>';",
    ],
    ['template-example.astro', 'const example = `<button onBlur={handler}>Example</button>`;'],
  ]) {
    const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', fileName);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, ['---', declaration, '---', '<p>{example}</p>'].join('\n'));
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores inline and backtick/tilde-fenced MDX examples during interaction scanning', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'content', 'docs', 'examples.mdx');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '# Event examples',
      '',
      'Inline `onBlur={handler}` and `onFocus={handler}` examples are prose.',
      '',
      '```tsx',
      '<button onDoubleClick={handler}>Example</button>',
      '```',
      '',
      '~~~tsx',
      '<button onMouseDown={handler}>Example</button>',
      '~~~~',
    ].join('\n')
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('keeps real MDX handler markup visible after Markdown code removal', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'interactive-example.mdx'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      'Inline `onBlur={example}` is prose.',
      '',
      '~~~tsx',
      '<button onFocus={example}>Fenced example</button>',
      '~~~',
      '',
      '<button onBlur={() => runDemo()}>Live MDX control</button>',
    ].join('\n')
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/interactive-example\.mdx` is not bound/
  );
});

test('rejects adapter and implementation-internal imports outside the website allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/ReactEscape.tsx',
      '@proto.ui/adapter-react',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
    [
      'apps/www/src/components/VueEscape.tsx',
      '@proto.ui/adapter-vue',
      "import { createVueAdapter } from '@proto.ui/adapter-vue';",
    ],
    [
      'apps/www/src/components/Vue2Escape.tsx',
      '@proto.ui/adapter-vue2',
      "import { createVue2Adapter } from '@proto.ui/adapter-vue2';",
    ],
    [
      'apps/www/src/components/WebComponentEscape.ts',
      '@proto.ui/adapter-web-component',
      "import { createWebComponentAdapter } from '@proto.ui/adapter-web-component';",
    ],
    [
      'apps/www/src/components/BasePackageEscape.ts',
      '@proto.ui/prototypes-base',
      "import { basePrototypes } from '@proto.ui/prototypes-base';",
    ],
    [
      'apps/www/src/components/ShadcnPackageEscape.ts',
      '@proto.ui/prototypes-shadcn',
      "import { shadcnPrototypes } from '@proto.ui/prototypes-shadcn';",
    ],
    [
      'apps/www/src/components/BrutalistPackageEscape.ts',
      '@proto.ui/prototypes-brutalist',
      "import { brutalistPrototypes } from '@proto.ui/prototypes-brutalist';",
    ],
    [
      'apps/www/src/components/BaseInternalEscape.tsx',
      '../../../../packages/prototypes/base/src/button/root.proto',
      "import { root } from '../../../../packages/prototypes/base/src/button/root.proto';",
    ],
    [
      'apps/www/src/components/ShadcnInternalEscape.tsx',
      '../../../../packages/prototypes/shadcn/src/button/root.proto',
      "import { root } from '../../../../packages/prototypes/shadcn/src/button/root.proto';",
    ],
    [
      'apps/www/src/components/BrutalistInternalEscape.astro',
      '../../../../packages/prototypes/brutalist/src/theme',
      [
        '---',
        "import { renderBrutalistThemeCss } from '../../../../packages/prototypes/brutalist/src/theme';",
        '---',
        '<style>{renderBrutalistThemeCss()}</style>',
      ].join('\n'),
    ],
  ];
  for (const [sourcePath, , content] of cases) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  const message = validationMessage(root);
  for (const [sourcePath, specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${sourcePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('accepts reviewed demo raw imports and ignores import-looking code strings', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [sourcePath, content] of [
    [
      'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
    [
      'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
      "export const load = () => import('../../../../../packages/prototypes/base/src/button/root.proto');",
    ],
    [
      'apps/www/src/components/BrutalistPageStyle.astro',
      [
        '---',
        "import { renderBrutalistThemeCss } from '../../../../packages/prototypes/brutalist/src/theme';",
        '---',
        '<style is:inline set:html={renderBrutalistThemeCss()} />',
      ].join('\n'),
    ],
    [
      'apps/www/src/components/CodeExample.ts',
      "export const example = `import { createVueAdapter } from '@proto.ui/adapter-vue';`;",
    ],
  ]) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('binds inherited surface manifests to the resolved dependency version', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    "lockfileVersion: '9.0'\nimporters:\n  apps/www:\n    dependencies:\n      '@astrojs/starlight':\n        specifier: ^0.35.2\n        version: 0.35.4(astro@5.18.1)\n",
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /inherited manifest @astrojs\/starlight@0\.35\.3 must match resolved @astrojs\/starlight@0\.35\.4/
  );
});

test('fails closed when an inherited dependency is absent from the lockfile importer', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    "lockfileVersion: '9.0'\nimporters:\n  apps/www:\n    dependencies: {}\n",
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /cannot resolve inherited dependency @astrojs\/starlight from pnpm-lock\.yaml importer apps\/www/
  );
});

test('binds inherited transitive Expressive Code surfaces to package versions', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const lockfilePath = path.join(root, 'pnpm-lock.yaml');
  fs.writeFileSync(
    lockfilePath,
    fs
      .readFileSync(lockfilePath, 'utf8')
      .replace(
        "'@expressive-code/plugin-frames': 0.41.7",
        "'@expressive-code/plugin-frames': 0.42.0"
      ),
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /inherited manifest .*@expressive-code\/plugin-frames@0\.41\.7.* must match resolved @expressive-code\/plugin-frames@0\.42\.0/
  );
});

test('ignores transitive Expressive Code versions reachable only from another workspace', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'pnpm-lock.yaml'),
    `lockfileVersion: '9.0'
importers:
  apps/www:
    dependencies:
      '@astrojs/starlight':
        specifier: ^0.35.2
        version: 0.35.3(astro@5.18.1)
  apps/unrelated:
    dependencies:
      expressive-code:
        specifier: ^0.42.0
        version: 0.42.0
packages:
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/core@0.42.0': {}
  '@expressive-code/plugin-frames@0.41.7': {}
  '@expressive-code/plugin-frames@0.42.0': {}
snapshots:
  '@astrojs/starlight@0.35.3(astro@5.18.1)':
    dependencies:
      astro-expressive-code: 0.41.7(astro@5.18.1)
  'astro-expressive-code@0.41.7(astro@5.18.1)':
    dependencies:
      rehype-expressive-code: 0.41.7
  'rehype-expressive-code@0.41.7':
    dependencies:
      expressive-code: 0.41.7
  'expressive-code@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
      '@expressive-code/plugin-frames': 0.41.7
  '@expressive-code/core@0.41.7': {}
  '@expressive-code/plugin-frames@0.41.7':
    dependencies:
      '@expressive-code/core': 0.41.7
  'expressive-code@0.42.0':
    dependencies:
      '@expressive-code/core': 0.42.0
      '@expressive-code/plugin-frames': 0.42.0
  '@expressive-code/core@0.42.0': {}
  '@expressive-code/plugin-frames@0.42.0':
    dependencies:
      '@expressive-code/core': 0.42.0
`,
    'utf8'
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects client interaction added to a native/static manifest source', () => {
  const root = createRoot();
  writeValidMatrices(root);
  fs.writeFileSync(
    path.join(root, 'apps', 'www', 'src', 'components', 'override', 'SiteTitle.astro'),
    '<a href="/">Home</a><script>addEventListener("click", () => {})</script>'
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/override\/SiteTitle\.astro` is owned only by native\/static rows/
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

test('requires a grouped binding to name every direct owner across exemption classes', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const sharedSource = 'apps/www/src/components/SharedPreviewClient.ts';
  const sourcePath = path.join(root, sharedSource);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'addEventListener("click", () => {})');

  const websiteRows = rowsWithRequiredIds(website, validWebsiteRow(), validWebsiteRow);
  websiteRows[0] = validWebsiteRow({
    ID: 'www.demo.runtime-select',
    Path: `\`${sharedSource}\``,
  });
  websiteRows[1] = validWebsiteRow({
    ID: 'www.demo.prototype-previewer',
    Path: `\`${sharedSource}\``,
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Proto UI chain': 'Website-owned preview infrastructure',
    Lifecycle: 'No catalog entity required',
    'Dependency and owner': 'owner: website team',
    'Escape or exemption':
      'Reason: raw preview mounting remains bounded demonstration infrastructure',
    'Re-review or removal issue': '#420 if the preview owns user-facing selection semantics',
  });
  writeMatrix(root, website, websiteRows, {
    extraText: [
      '## Source-scan bindings',
      '',
      '| Interactive or integration source | Owning matrix row |',
      '| --- | --- |',
      `| \`${sharedSource}\` | grouped row \`www.demo.runtime-select\` |`,
    ].join('\n'),
  });
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );

  assert.match(
    validationMessage(root),
    /grouped binding .* must name exactly the matrix Path owners \(www\.demo\.prototype-previewer, www\.demo\.runtime-select\)/
  );
});

test('rejects uncataloged entity IDs and stale lifecycle reporting', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'C-NOT-REAL; K-NOT-REAL; V-NOT-REAL; P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'Adapter profile is active',
    State: 'research',
    'Dependency and owner': '#420; owner: website team',
  });
  const message = validationMessage(root);
  assert.match(message, /references uncataloged entity ID `C-NOT-REAL`/);
  assert.match(message, /references uncataloged entity ID `K-NOT-REAL`/);
  assert.match(message, /references uncataloged entity ID `V-NOT-REAL`/);
  assert.match(message, /Lifecycle must report catalog status `draft`/);
});

test('binds every website lifecycle status to its exact catalog entity', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'P-BASE-BUTTON=active; A-WEB-COMPONENT-0001=draft',
    State: 'research',
    'Dependency and owner': '#420; owner: website team',
  });
  const message = validationMessage(root);
  assert.match(
    message,
    /Lifecycle must associate catalog entity `P-BASE-BUTTON` with status `draft`/
  );
  assert.match(
    message,
    /Lifecycle must associate catalog entity `A-WEB-COMPONENT-0001` with status `active`/
  );
});

test('rejects swapped per-entity lifecycle statuses in the Harness chain', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'Proto UI chain': 'P-BASE-SCROLL-AREA active; A-REACT-18-19-0001 draft',
    }
  );
  const message = validationMessage(root);
  assert.match(
    message,
    /Proto UI chain must associate catalog entity `P-BASE-SCROLL-AREA` with status `draft`/
  );
  assert.match(
    message,
    /Proto UI chain must associate catalog entity `A-REACT-18-19-0001` with status `active`/
  );
});

test('rejects stable website states backed by non-active catalog entities', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'P-BASE-BUTTON; A-WEB-COMPONENT-0001',
    Lifecycle: 'Prototype is draft; Adapter profile is active',
    State: 'ready',
  });
  assert.match(
    validationMessage(root),
    /website State `ready` requires every catalog entity in Proto UI chain to be active; received `P-BASE-BUTTON` \(draft\)/
  );
});

test('rejects a stable website state that removes every catalog identity from its chain', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'Generated facade with no catalog identity',
    Lifecycle: 'Claimed stable',
    State: 'self-hosted',
  });
  assert.match(
    validationMessage(root),
    /website State `self-hosted` must inventory at least one catalog entity in Proto UI chain/
  );
});

test('rejects a stable website state backed only by an active Adapter profile', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'Proto UI chain': 'A-WEB-COMPONENT-0001',
    Lifecycle: 'A-WEB-COMPONENT-0001=active',
    State: 'ready',
  });
  assert.match(
    validationMessage(root),
    /website State ready requires an active Prototype or Module semantic owner.*Adapter profile alone is insufficient/
  );
});

test('requires the raw-runtime row to inventory every shipped active Adapter profile', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.demo.raw-adapter-runtimes',
    'Proto UI chain': 'A-WEB-COMPONENT-0001; A-REACT-18-19-0001; A-VUE-3-0001',
    Lifecycle: 'All referenced Adapter profiles are active',
  });
  assert.match(
    validationMessage(root),
    /matrix row `www\.demo\.raw-adapter-runtimes` must inventory catalog entity `A-VUE-2-0001`/
  );
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

test('rejects a blank or prose interruption that splits the governed matrix table', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const matrixPath = path.join(root, MATRIX_CONFIGS[0].relativePath);
  const content = fs.readFileSync(matrixPath, 'utf8');
  fs.writeFileSync(
    matrixPath,
    content.replace('\n| www.shell.primary-nav |', '\n\n| www.shell.primary-nav |'),
    'utf8'
  );
  assert.match(
    validationMessage(root),
    /interrupts the matrix; data rows must remain contiguous through <!-- coverage-matrix:end -->/
  );
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

test('rejects vague exemptions without structured owner, reason, limit, and issue fields', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'Website platform',
    'Escape or exemption': 'temporary',
    'Re-review or removal issue': 'later',
  });
  const message = validationMessage(root);
  assert.match(message, /must give the `owner:` or `owners:` label a concrete value/);
  assert.match(message, /must give the `reason:` label a substantive explanation/);
  assert.match(message, /must state a bounded `limit:` or conditional trigger/);
  assert.match(message, /must link re-review or removal as #<issue>/);
});

test('rejects empty exemption labels and issue-only re-review text', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.infrastructure.pagefind-engine',
    'Target class': 'infrastructure-exempt',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'owner:',
    'Escape or exemption': 'Reason: only',
    'Re-review or removal issue': '#420',
  });
  const message = validationMessage(root);
  assert.match(message, /must give the `owner:` or `owners:` label a concrete value/);
  assert.match(message, /must give the `reason:` label a substantive explanation/);
  assert.match(message, /must state a bounded `limit:` or conditional trigger/);
});

test('requires every native/static website row to be registered in the manifest', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.unregistered-static',
    'Target class': 'native/static',
    State: 'native/static',
    'Proto UI chain': 'Native anchor',
    Lifecycle: 'Native HTML',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchor owns complete navigation semantics',
    'Re-review or removal issue': '#420 if app-owned interaction is introduced',
  });
  assert.match(
    validationMessage(root),
    /native\/static website row `www\.shell\.unregistered-static` must be registered in a non-interactive surface manifest/
  );
});

test('requires every non-interactive manifest entry to retain its expected class and state', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.site-title',
    'Target class': 'site-composition',
    State: 'blocked',
    'Dependency and owner': '#420; owner: website team',
  });
  assert.match(
    validationMessage(root),
    /non-interactive manifest row `www\.shell\.site-title` must use Target class `native\/static` and State `native\/static`/
  );
});

test('rejects deletion of a non-native static projection even when totals are updated', () => {
  const root = createRoot();
  const websiteRows = rowsWithRequiredIds(
    MATRIX_CONFIGS[0],
    validWebsiteRow(),
    validWebsiteRow
  ).filter((row) => row.ID !== 'www.shell.social-links');
  writeMatrix(root, MATRIX_CONFIGS[0], websiteRows);
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );
  assert.match(
    validationMessage(root),
    /required inventory surface ID `www\.shell\.social-links` is missing from non-interactive manifest/
  );
});

test('rejects class or state drift for a non-native static projection', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.social-links',
    'Target class': 'native/static',
    State: 'native/static',
    'Proto UI chain': 'Native anchor',
    Lifecycle: 'Native HTML',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchors own complete navigation semantics',
    'Re-review or removal issue': '#420 if app-owned interaction is introduced',
  });
  assert.match(
    validationMessage(root),
    /non-interactive manifest row `www\.shell\.social-links` must use Target class `site-composition` and State `research`/
  );
});

test('requires manifest rows to retain exact source-path bindings', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.site-title',
    Path: 'apps/www/src/components/Missing.astro',
    Evidence: 'source baseline without an exact path code span',
    'Target class': 'native/static',
    State: 'native/static',
    'Proto UI chain': 'Native anchor',
    Lifecycle: 'Native HTML',
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchor owns complete navigation semantics',
    'Re-review or removal issue': '#420 if app-owned interaction is introduced',
  });
  assert.match(
    validationMessage(root),
    /matrix row `www\.shell\.site-title` must bind repository path `apps\/www\/src\/components\/override\/SiteTitle\.astro` as an exact code span/
  );
});

test('requires non-native static projections to retain exact source-path bindings', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    ID: 'www.shell.social-links',
    Path: 'apps/www/src/components/Missing.astro',
    Evidence: 'source baseline without an exact path code span',
    'Target class': 'site-composition',
    State: 'research',
    'Dependency and owner': '#420; owner: website team',
  });
  assert.match(
    validationMessage(root),
    /matrix row `www\.shell\.social-links` must bind repository path `apps\/www\/src\/components\/override\/SocialIcons\.astro` as an exact code span/
  );
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
    'Dependency and owner': 'No Proto UI dependency; owner: website team',
    'Escape or exemption': 'Reason: native anchor needs no protocol owner',
    'Re-review or removal issue': '#420 if interaction state is added',
  });
  const message = validationMessage(root);
  assert.match(message, /Path references missing repository path/);
  assert.match(message, /Target class `native\/static` requires State `native\/static`/);

  const reverseRoot = createRoot();
  writeValidMatrices(reverseRoot, {
    'Target class': 'official-prototype',
    State: 'infrastructure-exempt',
    'Dependency and owner': 'owner: website team',
    'Escape or exemption': 'Reason: temporary website infrastructure boundary',
    'Re-review or removal issue': '#420 when the boundary changes',
  });
  assert.match(
    validationMessage(reverseRoot),
    /State `infrastructure-exempt` requires Target class `infrastructure-exempt`, received `official-prototype`/
  );
});

test('allows an app-local prototype row to advance to dogfooded with implementation evidence', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const repositoryPath of [implementationPath, evidencePath]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      repositoryPath === evidencePath
        ? 'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: abc123\nEnvironment: fixture\nFixtures: tool invocation\nCommands: pnpm test\nResults: passed\n'
        : 'fixture',
      'utf8'
    );
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects dogfooded Harness rows that consume removed catalog entities', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/RemovedButton.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/removed-button.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: abc123\nEnvironment: fixture\nFixtures: removed button\nCommands: pnpm test\nResults: passed\n',
    ],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Removed Button prototype',
      'Target class': 'app-local-proto',
      'Proto UI chain': 'P-REMOVED-BUTTON removed',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.match(
    validationMessage(root),
    /dogfooded rows must not consume removed catalog entities: `P-REMOVED-BUTTON`/
  );
});

test('rejects dogfooded Harness rows without real multi-dimensional evidence', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: '`apps/agent-harness/src/run/Missing.tsx`',
      Evidence: 'shipped',
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  const message = validationMessage(root);
  assert.match(message, /dogfooded implementation path does not exist/);
  assert.match(
    message,
    /dogfooded rows must bind an exact internal\/agent-harness\/evidence\/\*\* path/
  );
  for (const label of ['Build:', 'Browser:', 'Accessibility:', 'Lifecycle:', 'Design:']) {
    assert.ok(message.includes(`missing required \`${label}\` label`));
  }
});

test('rejects a dogfooded evidence file without reproducible record fields', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [evidencePath, 'Build: passed'],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  const message = validationMessage(root);
  assert.match(message, /dogfooded evidence record .* missing required `Browser:` label/);
  assert.match(message, /dogfooded evidence record .* missing required `Commit:` label/);
  assert.match(message, /dogfooded evidence record .* missing required `Commands:` label/);
});

test('rejects empty required values in dogfooded matrix and evidence records', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build:\nBrowser:\nAccessibility:\nLifecycle:\nDesign:\nCommit:\nEnvironment:\nFixtures:\nCommands:\nResults:\n',
    ],
  ]) {
    const absolutePath = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.run.tool-invocation',
      'Target owner': 'Harness app-local Tool Invocation prototype',
      'Target class': 'app-local-proto',
      State: 'dogfooded',
      Path: `\`${implementationPath}\``,
      Evidence: `Build:; Browser:; Accessibility:; Lifecycle:; Design:; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  const message = validationMessage(root);
  assert.match(
    message,
    /dogfooded evidence record .* required `Commit:` label must have a meaningful value/
  );
  assert.match(
    message,
    /dogfooded evidence record .* required `Results:` label must have a meaningful value/
  );
  assert.match(message, /required `Build:` label must have a meaningful value/);
  assert.match(message, /required `Design:` label must have a meaningful value/);
});

test('protects every authoritative Harness baseline row from deletion', () => {
  const root = createRoot();
  const harness = MATRIX_CONFIGS[1];
  const harnessRows = rowsWithRequiredIds(harness, validHarnessRow(), validHarnessRow).filter(
    (row) => row.ID !== 'harness.composer.root'
  );
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(), validWebsiteRow)
  );
  writeMatrix(root, harness, harnessRows);
  assert.match(
    validationMessage(root),
    /required inventory surface ID `harness\.composer\.root` is missing/
  );
});

test('protects every authoritative Website baseline row from deletion', () => {
  const root = createRoot();
  const website = MATRIX_CONFIGS[0];
  const websiteRows = rowsWithRequiredIds(
    website,
    validWebsiteRow({ ID: 'www.docs.code-panel-expand' }),
    validWebsiteRow
  ).filter((row) => row.ID !== 'www.docs.code-panel-expand');
  writeMatrix(root, website, websiteRows);
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(), validHarnessRow)
  );
  assert.match(
    validationMessage(root),
    /required inventory surface ID `www\.docs\.code-panel-expand` is missing/
  );
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
