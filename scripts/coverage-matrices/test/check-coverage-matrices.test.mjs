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

function validSelfHostedWebsiteEvidence(overrides = {}) {
  return Object.entries({
    Commit: '0123456789abcdef0123456789abcdef01234567',
    Environment: 'Node.js 22 and Chromium on CI',
    Routes: '`/en/` and `/zh-cn/`',
    Build: '`internal/website/evidence/s14/build.log`',
    Browser: '`internal/website/evidence/s14/browser-results.json`',
    Accessibility: '`internal/website/evidence/s14/accessibility-results.json`',
    Screenshot: '`internal/website/evidence/s14/home-desktop.png`',
    'Multi-frame': '`internal/website/evidence/s14/navigation-frames.json`',
    Commands:
      '`corepack pnpm@10.32.1 --filter @proto-ui/www build` and `corepack pnpm@10.32.1 test`',
    Results: '`internal/website/evidence/s14/results.json`',
    ...overrides,
  })
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function writeSelfHostedWebsiteArtifacts(root) {
  const artifactRoot = path.join(root, 'internal/website/evidence/s14');
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'build.log'), 'build completed\n', 'utf8');
  fs.writeFileSync(path.join(artifactRoot, 'browser-results.json'), '{"passed":true}\n', 'utf8');
  fs.writeFileSync(
    path.join(artifactRoot, 'accessibility-results.json'),
    '{"violations":[]}\n',
    'utf8'
  );
  fs.writeFileSync(path.join(artifactRoot, 'home-desktop.png'), onePixelPng);
  fs.writeFileSync(path.join(artifactRoot, 'navigation-before.png'), onePixelPng);
  fs.writeFileSync(path.join(artifactRoot, 'navigation-after.png'), onePixelPng);
  fs.writeFileSync(
    path.join(artifactRoot, 'navigation-frames.json'),
    JSON.stringify({
      frames: [
        'internal/website/evidence/s14/navigation-before.png',
        'internal/website/evidence/s14/navigation-after.png',
      ],
    }),
    'utf8'
  );
  fs.writeFileSync(path.join(artifactRoot, 'results.json'), '{"passed":true}\n', 'utf8');
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
  const defaultWebsiteBindings = [
    '## Source-scan bindings',
    '',
    '| Interactive or integration source | Owning matrix row |',
    '| --- | --- |',
    '| `apps/www/src/components/override/Header.astro` | `www.shell.primary-nav`, `www.shell.header-separators` |',
  ].join('\n');
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
      extraText || (config.kind === 'website' ? defaultWebsiteBindings : ''),
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

function writeValidMatrices(
  root,
  websiteOverrides = {},
  harnessOverrides = {},
  { websiteBindings = [], harnessBindings = [] } = {}
) {
  const extraText = [
    '## Source-scan bindings',
    '',
    '| Interactive or integration source | Owning matrix row |',
    '| --- | --- |',
    '| `apps/www/src/components/override/Header.astro` | `www.shell.primary-nav`, `www.shell.header-separators` |',
    ...websiteBindings.map(
      ([sourcePath, ownerIds]) =>
        `| \`${sourcePath}\` | ${ownerIds.map((ownerId) => `\`${ownerId}\``).join(', ')} |`
    ),
  ].join('\n');
  writeMatrix(
    root,
    MATRIX_CONFIGS[0],
    rowsWithRequiredIds(MATRIX_CONFIGS[0], validWebsiteRow(websiteOverrides), validWebsiteRow),
    { extraText }
  );
  writeMatrix(
    root,
    MATRIX_CONFIGS[1],
    rowsWithRequiredIds(MATRIX_CONFIGS[1], validHarnessRow(harnessOverrides), validHarnessRow),
    {
      extraText:
        harnessBindings.length === 0
          ? ''
          : [
              '## Source-scan bindings',
              '',
              '| Interactive or integration source | Owning matrix row |',
              '| --- | --- |',
              ...harnessBindings.map(
                ([sourcePath, ownerIds]) =>
                  `| \`${sourcePath}\` | ${ownerIds.map((ownerId) => `\`${ownerId}\``).join(', ')} |`
              ),
            ].join('\n'),
    }
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

test('includes content-local JavaScript and TypeScript interactions in the website scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    [
      'apps/www/src/content/docs/Widget.tsx',
      'export const Widget = () => <button onClick={() => {}} />;',
    ],
    ['apps/www/src/content/docs/behavior.js', 'host.addEventListener("click", activate);'],
    [
      'apps/www/src/content/docs/registry.ts',
      'window.customElements.define("x-fixture", FixtureElement);',
    ],
    [
      'apps/www/src/content/docs/observer.ts',
      'const observer = new window.MutationObserver(update);',
    ],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/content/docs/Widget.tsx',
    'apps/www/src/content/docs/behavior.js',
    'apps/www/src/content/docs/registry.ts',
    'apps/www/src/content/docs/observer.ts',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('detects DOM event-property assignments in website helpers', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    ['apps/www/src/content/docs/click-property.ts', 'button.onclick = activate;'],
    ['apps/www/src/content/docs/key-property.js', 'window.onkeydown = handleKey;'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/content/docs/click-property.ts',
    'apps/www/src/content/docs/key-property.js',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('ignores interactive-looking source snippets stored as content data', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/demo_components/example/exampleCode.ts';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    'export const codeMap = { wc: `<script>host.addEventListener("click", activate)</script>`, react: `<button onClick={() => activate()} />` };'
  );
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores inert JSON data scripts during interaction discovery', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/content/docs/StructuredData.astro',
      '<script type="application/ld+json">{"@type":"WebSite"}</script>',
    ],
    [
      'apps/www/src/content/docs/data.mdx',
      '<script type="application/json">{"fixture":true}</script>',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(root);
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
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

test('detects lowercase native event attributes without an event-name allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, attribute] of [
    ['apps/www/src/components/BlurControl.astro', 'onblur'],
    ['apps/www/src/content/docs/focus-control.mdx', 'onfocus'],
    ['apps/www/src/components/DoubleClickControl.astro', 'ondblclick'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `<input ${attribute}="validate()" />`);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/components/BlurControl.astro',
    'apps/www/src/content/docs/focus-control.mdx',
    'apps/www/src/components/DoubleClickControl.astro',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('discovers DOM event-property assignments in the website source scan', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/www/src/components/EventPropertyControl.ts';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    "const button = document.querySelector('button'); button.onclick = () => {};"
  );
  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/components\/EventPropertyControl\.ts` is not bound/
  );
});

test('does not classify ordinary lowercase on-prefixed component props as events', () => {
  const root = createRoot();
  const cases = [
    ['apps/www/src/components/OnlyCard.astro', '<Card only={true} />'],
    ['apps/www/src/components/OnceCard.tsx', '<Card once="session" />'],
    ['apps/www/src/components/OngoingCard.vue', '<template><Card ongoing="yes" /></template>'],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: cases.map(([relativePath]) => [relativePath, ['www.shell.search']]),
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('discovers interactive Vue and Svelte website components', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    [
      'apps/www/src/components/NewControl.vue',
      '<template><button onblur="close()">Close</button></template>',
    ],
    ['apps/www/src/content/docs/NewControl.svelte', '<button ondblclick="open()">Open</button>'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/components/NewControl.vue',
    'apps/www/src/content/docs/NewControl.svelte',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('detects Vue and Svelte template event directives', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, content] of [
    [
      'apps/www/src/components/VueShortControl.vue',
      '<template><button @click="open" /></template>',
    ],
    [
      'apps/www/src/components/VueLongControl.vue',
      '<template><button v-on:click.prevent="open" /></template>',
    ],
    [
      'apps/www/src/content/docs/SvelteControl.svelte',
      '<button on:click|preventDefault={open}>Open</button>',
    ],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  const message = validationMessage(root);
  for (const relativePath of [
    'apps/www/src/components/VueShortControl.vue',
    'apps/www/src/components/VueLongControl.vue',
    'apps/www/src/content/docs/SvelteControl.svelte',
  ]) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
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
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [['apps/www/src/components/comparison.tsx', ['www.shell.search']]],
    }
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
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [['apps/www/src/components/template-example.tsx', ['www.shell.search']]],
    }
  );
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
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [
        ['apps/www/src/components/single-quoted-example.astro', ['www.shell.search']],
        ['apps/www/src/components/template-example.astro', ['www.shell.search']],
      ],
    }
  );
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

test('ignores four-space and tab-indented Markdown code examples', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'indented-examples.mdx'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '# Indented examples',
      '',
      '    button.addEventListener("click", runExample);',
      '    import "@proto.ui/runtime";',
      '',
      '\telement.focus();',
      '\timport "@proto.ui/prototypes-base";',
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

test('keeps indented live handlers inside nested MDX JSX visible', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(
    root,
    'apps',
    'www',
    'src',
    'content',
    'docs',
    'nested-interactive-example.mdx'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '# Live nested control',
      '',
      '<section>',
      '    <button onClick={runDemo}>Run</button>',
      '</section>',
    ].join('\n')
  );

  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/nested-interactive-example\.mdx` is not bound/
  );
});

test('keeps nested same-tag MDX depth before classifying later indented live markup', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/www/src/content/docs/nested-same-tag-interactive.mdx';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '<section>',
      '  <section>',
      '  </section>',
      '    <button onClick={runDemo}>Run</button>',
      '</section>',
    ].join('\n')
  );

  assert.ok(
    validationMessage(root).includes(`interactive website source \`${relativePath}\` is not bound`)
  );
});

test('detects Astro client hydration directives in live MDX markup', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const hydratedSources = ['load', 'visible', 'idle', 'only'].map(
    (directive) => `apps/www/src/content/docs/hydrated-${directive}.mdx`
  );
  for (const relativePath of hydratedSources) {
    const directive = path.basename(relativePath, '.mdx').replace('hydrated-', '');
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(
      sourcePath,
      [
        "import ExternalWidget from '@example/widget';",
        '',
        `<ExternalWidget client:${directive}${directive === 'only' ? '="react"' : ''} />`,
      ].join('\n')
    );
  }
  const examplePath = 'apps/www/src/content/docs/hydration-example.mdx';
  const exampleSource = path.join(root, examplePath);
  fs.writeFileSync(
    exampleSource,
    [
      '# Hydration example',
      '',
      '```mdx',
      '<ExternalWidget client:load />',
      '```',
      '',
      '{"<ExternalWidget client:visible />"}',
      '{/* <ExternalWidget client:idle /> */}',
    ].join('\n')
  );

  const message = validationMessage(root);
  for (const relativePath of hydratedSources) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
  assert.ok(!message.includes(`interactive website source \`${examplePath}\` is not bound`));
});

test('detects bounded DOM focus, scroll, ARIA, and class-state mutations', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    ['blur-owner.ts', 'element.blur();'],
    ['focus-owner.ts', 'element.focus();'],
    ['scroll-by-owner.ts', 'element.scrollBy({ top: 1 });'],
    ['scroll-into-view-owner.ts', 'element.scrollIntoView({ block: "nearest" });'],
    ['scroll-to-owner.ts', 'element.scrollTo({ top: 1 });'],
    ['aria-set-owner.ts', "element.setAttribute('aria-expanded', 'true');"],
    ['aria-toggle-owner.ts', "element.toggleAttribute('aria-hidden');"],
    ['aria-remove-owner.ts', "element.removeAttribute('aria-expanded');"],
    ['class-add-owner.ts', "element.classList.add('is-open');"],
    ['class-remove-owner.ts', "element.classList.remove('is-open');"],
    ['class-replace-owner.ts', "element.classList.replace('closed', 'open');"],
    ['class-toggle-owner.ts', "element.classList.toggle('is-open');"],
    ['typed-owner.ts', 'const control: HTMLButtonElement = getControl(); control.focus();'],
    [
      'queried-owner.ts',
      "const control = document.querySelector('button'); control?.scrollIntoView();",
    ],
  ];
  for (const [fileName, content] of cases) {
    const relativePath = `apps/www/src/content/docs/${fileName}`;
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `export function ownState(element) { ${content} }`);
  }
  const examplePath = 'apps/www/src/content/docs/dom-mutation-examples.ts';
  fs.writeFileSync(
    path.join(root, examplePath),
    [
      'export const focusExample = "element.focus()";',
      'export const scrollExample = `element.scrollIntoView()`;',
      'export const ariaExample = "element.setAttribute(\'aria-expanded\', true)";',
      'export const classExample = "element.classList.toggle(\'open\')";',
    ].join('\n')
  );

  const message = validationMessage(root);
  for (const [fileName] of cases) {
    const relativePath = `apps/www/src/content/docs/${fileName}`;
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
  assert.ok(!message.includes(`interactive website source \`${examplePath}\` is not bound`));
});

test('follows post-declaration DOM receiver assignments without leaking inner scopes', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const livePath = 'apps/www/src/content/docs/assigned-dom-receiver.ts';
  const safePath = 'apps/www/src/content/docs/scoped-dom-receiver.ts';
  for (const [relativePath, content] of [
    [livePath, "let element; element = document.querySelector('button'); element.focus();"],
    [
      safePath,
      "let element = model; function inspect() { element = document.querySelector('button'); } element.focus();",
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  assert.ok(message.includes(`interactive website source \`${livePath}\` is not bound`));
  assert.ok(!message.includes(`interactive website source \`${safePath}\` is not bound`));
});

test('does not let function-like parameters hide later outer DOM receiver uses', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/content/docs/dom-after-function-parameter.ts',
      "const control = document.querySelector('button'); function inspect(control) { control.focus(); } control.focus();",
    ],
    [
      'apps/www/src/content/docs/dom-after-arrow-parameter.ts',
      "const control = document.querySelector('button'); const inspect = (control) => control.focus(); control.focus();",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath] of cases) {
    assert.ok(message.includes(`interactive website source \`${relativePath}\` is not bound`));
  }
});

test('does not infer DOM ownership from generic receiver method names', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = 'apps/www/src/content/docs/generic-methods.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'searchIndex.blur();',
      'searchIndex.focus();',
      'searchIndex.scrollBy();',
      'searchIndex.scrollIntoView();',
      'searchIndex.scrollTo();',
      "metadata.setAttribute('aria-label', 'result');",
      "metadata.toggleAttribute('aria-hidden');",
      "metadata.removeAttribute('aria-expanded');",
      "model.classList.add('one');",
      "model.classList.remove('one');",
      "model.classList.replace('one', 'two');",
      "model.classList.toggle('two');",
    ].join('\n')
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('detects DOM mutations in live MDX ESM while excluding authored examples', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const livePath = 'apps/www/src/content/docs/live-restore.mdx';
  const liveSource = path.join(root, livePath);
  fs.mkdirSync(path.dirname(liveSource), { recursive: true });
  fs.writeFileSync(
    liveSource,
    ['export function restore(element) {', '  element.focus();', '}', '', '# Restore'].join('\n')
  );
  const liveAriaPath = 'apps/www/src/content/docs/live-aria-reset.mdx';
  fs.writeFileSync(
    path.join(root, liveAriaPath),
    [
      'export function reset(element) {',
      "  element.removeAttribute('aria-expanded');",
      '}',
      '',
      '# Reset',
    ].join('\n')
  );
  const examplePath = 'apps/www/src/content/docs/dom-authored-examples.mdx';
  fs.writeFileSync(
    path.join(root, examplePath),
    [
      '# DOM examples',
      '',
      'Inline `element.focus()` is prose.',
      '',
      '```ts',
      'export function example(element) { element.blur(); }',
      '```',
      '',
      '{"element.scrollIntoView()"}',
      '{/* element.scrollTo() */}',
    ].join('\n')
  );

  const message = validationMessage(root);
  assert.ok(message.includes(`interactive website source \`${livePath}\` is not bound`));
  assert.ok(message.includes(`interactive website source \`${liveAriaPath}\` is not bound`));
  assert.ok(!message.includes(`interactive website source \`${examplePath}\` is not bound`));
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
      'apps/www/src/components/LucidePackageEscape.ts',
      '@proto.ui/prototypes-lucide',
      "import { icon } from '@proto.ui/prototypes-lucide';",
    ],
    [
      'apps/www/src/components/CorePackageEscape.ts',
      '@proto.ui/core',
      "import { definePrototype } from '@proto.ui/core';",
    ],
    [
      'apps/www/src/components/RuntimePackageEscape.ts',
      '@proto.ui/runtime',
      "import { createRuntimeSession } from '@proto.ui/runtime';",
    ],
    [
      'apps/www/src/components/ModulePackageEscape.ts',
      '@proto.ui/module-overlay',
      "import { overlay } from '@proto.ui/module-overlay';",
    ],
    [
      'apps/www/src/components/AdapterBasePackageEscape.ts',
      '@proto.ui/adapter-base',
      "import { adapter } from '@proto.ui/adapter-base';",
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
    [
      'apps/www/src/components/LucideInternalEscape.ts',
      '../../../../packages/prototypes/lucide/src/icon/icon.proto',
      "import { asLucideIcon } from '../../../../packages/prototypes/lucide/src/icon/icon.proto';",
    ],
    [
      'apps/www/src/components/CoreInternalEscape.ts',
      '../../../../packages/core/src/index',
      "import { definePrototype } from '../../../../packages/core/src/index';",
    ],
    [
      'apps/www/src/components/RuntimeInternalEscape.ts',
      '../../../../packages/runtime/src/index',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index';",
    ],
    [
      'apps/www/src/components/ModuleInternalEscape.ts',
      '../../../../packages/modules/overlay/src/index',
      "import { overlay } from '../../../../packages/modules/overlay/src/index';",
    ],
    [
      'apps/www/src/components/AdapterInternalEscape.ts',
      '../../../../packages/adapters/react/src/index',
      "import { adapter } from '../../../../packages/adapters/react/src/index';",
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

test('classifies Vite import suffixes before enforcing exact Website allowances', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
      '@proto.ui/core?raw',
      "import { definePrototype } from '@proto.ui/core?raw';",
    ],
    [
      'apps/www/src/components/InternalQueryEscape.ts',
      '../../../../packages/runtime/src/index#fixture',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index#fixture';",
    ],
  ];
  for (const [relativePath, , content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath, specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('resolves the configured Website source alias before enforcing the consumer wall', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const configPath = path.join(root, 'apps/www/astro.config.mjs');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      "import { fileURLToPath } from 'node:url';",
      "export default { vite: { resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } } };",
    ].join('\n')
  );
  const sourcePath = 'apps/www/src/components/AliasEscape.ts';
  const absolutePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { localHelper } from '@/utils/local-helper';",
      "import { createRuntimeSession } from '@/../../../packages/runtime/src/index';",
    ].join('\n')
  );

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      `raw Proto UI import \`@/../../../packages/runtime/src/index\` in \`${sourcePath}\` escapes the website consumer-wall allowlist`
    )
  );
  assert.doesNotMatch(message, /@\/utils\/local-helper.*escapes the website consumer-wall/);
});

test('rejects raw Proto UI imports outside the Harness bootstrap allowlist', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const bootstrapSource = 'apps/agent-harness/src/proto-ui/bootstrap.tsx';
  const forbiddenImports = [
    [
      'apps/agent-harness/src/run/UnsafeRuntimeConsumer.tsx',
      '@proto.ui/runtime',
      "import { createRuntimeSession } from '@proto.ui/runtime';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeAdapterConsumer.tsx',
      '@proto.ui/adapter-react',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
    [
      'apps/agent-harness/src/run/UnsafePrototypeConsumer.tsx',
      '@proto.ui/prototypes-base/button',
      "import { button } from '@proto.ui/prototypes-base/button';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeInternalConsumer.tsx',
      '../../../../packages/runtime/src/index',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeHooksConsumer.tsx',
      '@proto.ui/hooks',
      "import { hook } from '@proto.ui/hooks';",
    ],
    [
      'apps/agent-harness/src/run/UnsafeHooksInternalConsumer.tsx',
      '../../../../packages/hooks/src/index',
      "import { hook } from '../../../../packages/hooks/src/index';",
    ],
    [
      'apps/agent-harness/src/run/unsafe-theme.scss',
      '@proto.ui/prototypes-brutalist/theme',
      "@use '@proto.ui/prototypes-brutalist/theme';",
    ],
  ];
  for (const [relativePath, , content] of [
    ...forbiddenImports,
    [
      bootstrapSource,
      '@proto.ui/adapter-react',
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  const message = validationMessage(root);
  for (const [sourcePath, specifier] of forbiddenImports) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${sourcePath}\` escapes the Harness consumer-wall allowlist`
      )
    );
  }
  assert.doesNotMatch(message, /bootstrap\.tsx.*escapes the Harness consumer-wall allowlist/);
});

test('allows only the reviewed Adapter entry at the Harness bootstrap boundary', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const bootstrapSource = 'apps/agent-harness/src/proto-ui/bootstrap.tsx';
  const absolutePath = path.join(root, bootstrapSource);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      "import { createReactAdapter } from '@proto.ui/adapter-react';",
      "import { definePrototype } from '@proto.ui/core';",
    ].join('\n')
  );

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      `raw Proto UI import \`@proto.ui/core\` in \`${bootstrapSource}\` escapes the Harness consumer-wall allowlist`
    )
  );
  assert.ok(
    !message.includes(
      `raw Proto UI import \`@proto.ui/adapter-react\` in \`${bootstrapSource}\` escapes the Harness consumer-wall allowlist`
    )
  );
});

test('classifies Vite import suffixes before enforcing exact Harness allowances', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/agent-harness/src/proto-ui/bootstrap.tsx',
      '@proto.ui/adapter-react?worker',
      "import { createReactAdapter } from '@proto.ui/adapter-react?worker';",
    ],
    [
      'apps/agent-harness/src/run/InternalHashEscape.ts',
      '../../../../packages/runtime/src/index#fixture',
      "import { createRuntimeSession } from '../../../../packages/runtime/src/index#fixture';",
    ],
  ];
  for (const [relativePath, , content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath, specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the Harness consumer-wall allowlist`
      )
    );
  }
});

test('rejects guarded imports from embedded component style blocks', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [relativePath, specifier] of [
    ['apps/www/src/components/AstroStyleEscape.astro', '@proto.ui/prototypes-base/styles.css'],
    ['apps/www/src/components/VueStyleEscape.vue', '@proto.ui/runtime/styles.css'],
    ['apps/www/src/components/SvelteStyleEscape.svelte', '@proto.ui/module-overlay/styles.css'],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, `<style>@import "${specifier}";</style>`);
  }
  const message = validationMessage(root);
  for (const [relativePath, specifier] of [
    ['apps/www/src/components/AstroStyleEscape.astro', '@proto.ui/prototypes-base/styles.css'],
    ['apps/www/src/components/VueStyleEscape.vue', '@proto.ui/runtime/styles.css'],
    ['apps/www/src/components/SvelteStyleEscape.svelte', '@proto.ui/module-overlay/styles.css'],
  ]) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('ignores import-looking CSS strings and comments in embedded style blocks', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/StyleExamples.astro';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      '<style>',
      '/* @import "@proto.ui/prototypes-base/comment.css"; */',
      '.example::before { content: "@import \'@proto.ui/runtime/string.css\'"; }',
      '</style>',
    ].join('\n')
  );
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [[relativePath, ['www.shell.search']]],
    }
  );
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects guarded imports nested in embedded Sass and Less style blocks', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/components/NestedStyleEscape.vue',
      '<style lang="scss">.scope { @import "@proto.ui/runtime/styles.css"; }</style>',
      '@proto.ui/runtime/styles.css',
    ],
    [
      'apps/www/src/components/NestedStyleEscape.svelte',
      '<style lang="less">.scope { @import "@proto.ui/module-overlay/styles.css"; }</style>',
      '@proto.ui/module-overlay/styles.css',
    ],
    [
      'apps/www/src/components/CommentMarkerStyleEscape.vue',
      '<style lang="scss">$marker: "/*"; @import "@proto.ui/runtime/marker.css"; /* trailing comment */</style>',
      '@proto.ui/runtime/marker.css',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: cases.map(([relativePath]) => [relativePath, ['www.shell.search']]),
    }
  );
  const message = validationMessage(root);
  for (const [relativePath, , specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('rejects guarded Sass module directives in standalone and embedded styles', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/styles/ModuleEscape.scss',
      '@use "@proto.ui/runtime/styles" as runtime;',
      '@proto.ui/runtime/styles',
    ],
    [
      'apps/www/src/components/ForwardEscape.astro',
      '<style lang="scss">@forward "@proto.ui/prototypes-base/theme";</style>',
      '@proto.ui/prototypes-base/theme',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    { websiteBindings: [['apps/www/src/components/ForwardEscape.astro', ['www.shell.search']]] }
  );
  const message = validationMessage(root);
  for (const [relativePath, , specifier] of cases) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
});

test('inspects every target in a Sass multi-target import', () => {
  const root = createRoot();
  const cases = [
    [
      'apps/www/src/styles/MultiTargetEscape.scss',
      '@import url("./base"), "@proto.ui/runtime/styles";',
      '@proto.ui/runtime/styles',
    ],
    [
      'apps/agent-harness/src/run/MultiTargetEscape.scss',
      '@import url("./base"), "@proto.ui/runtime/styles";',
      '@proto.ui/runtime/styles',
    ],
    [
      'apps/www/src/components/MultiTargetEscape.astro',
      '<style lang="scss">@import "./base", "@proto.ui/prototypes-base/theme";</style>',
      '@proto.ui/prototypes-base/theme',
    ],
  ];
  for (const [relativePath, content] of cases) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(
    root,
    {},
    {},
    { websiteBindings: [['apps/www/src/components/MultiTargetEscape.astro', ['www.shell.search']]] }
  );

  const message = validationMessage(root);
  for (const [relativePath, , specifier] of cases.filter(([relativePath]) =>
    relativePath.startsWith('apps/www/')
  )) {
    assert.ok(
      message.includes(
        `raw Proto UI import \`${specifier}\` in \`${relativePath}\` escapes the website consumer-wall allowlist`
      )
    );
  }
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime/styles` in `apps/agent-harness/src/run/MultiTargetEscape.scss` escapes the Harness consumer-wall allowlist'
    )
  );
});

test('ignores Sass and Less line-comment directives', () => {
  const root = createRoot();
  const componentPath = 'apps/www/src/components/CommentedStyle.astro';
  for (const [relativePath, content] of [
    ['apps/www/src/styles/Commented.scss', '// @use "@proto.ui/runtime/styles";'],
    [
      componentPath,
      '<style lang="less">// @import "@proto.ui/module-overlay/styles.css";\n.safe { color: red; }</style>',
    ],
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }
  writeValidMatrices(root, {}, {}, { websiteBindings: [[componentPath, ['www.shell.search']]] });
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not confuse an unquoted URL protocol with a Sass line comment', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/styles/UrlThenModule.scss';
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    '@import url(https://cdn.example/x.css); @use "@proto.ui/runtime/styles" as runtime;'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/runtime\/styles` in `apps\/www\/src\/styles\/UrlThenModule\.scss` escapes the website consumer-wall allowlist/
  );
});

test('requires new static website components to have a matrix classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const sourcePath = path.join(root, 'apps', 'www', 'src', 'components', 'StaticSurface.astro');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, '<h2>Help</h2><a href="/docs">Docs</a><details>More</details>');
  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/components\/StaticSurface\.astro` is not classified by a matrix row/
  );
});

test('discovers exported Website components rendered through React factories in JS and TS', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/ClassicSurface.js',
      "import React from 'react'; export function ClassicSurface() { return React.createElement('section', null, 'Classic'); }",
    ],
    [
      'apps/www/src/components/AliasedSurface.ts',
      "import { createElement as h } from 'react'; export const AliasedSurface = () => h('section', null, 'Aliased');",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath] of cases) {
    assert.ok(
      message.includes(
        `website component source \`${relativePath}\` is not classified by a matrix row`
      ),
      `${relativePath} must remain protected by the Website component scan`
    );
  }
});

test('does not classify non-exported or non-React JavaScript factories as Website components', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/www/src/components/PrivateFactory.js',
      "import * as React from 'react'; function PrivateFactory() { return React.createElement('section'); }",
    ],
    [
      'apps/www/src/components/LocalFactory.ts',
      "const createElement = (name) => ({ name }); export function makeDescriptor() { return createElement('section'); }",
    ],
    [
      'apps/www/src/components/ExportedData.ts',
      "import React from 'react'; export const metadata = { renderer: React };",
    ],
    [
      'apps/www/src/components/PrivateReactFactory.js',
      "import React from 'react'; const PrivateSurface = () => React.createElement('section'); export const metadata = { kind: 'data' };",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects a conflicting source binding for a static website component with one direct owner', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {},
    {
      websiteBindings: [['apps/www/src/components/override/SiteTitle.astro', ['www.shell.search']]],
    }
  );
  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/components\/override\/SiteTitle\.astro` has direct matrix owner `www\.shell\.site-title` outside source binding owner\(s\).*`www\.shell\.search`/
  );
});

test('requires static Markdown and MDX website routes to have a matrix classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const routes = [
    ['apps/www/src/pages/release-notes.md', '# Release notes\n\nStatic route.'],
    ['apps/www/src/pages/about.mdx', '# About\n\nAuthored MDX route.'],
  ];
  for (const [relativePath, content] of routes) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, content);
  }

  const message = validationMessage(root);
  for (const [relativePath] of routes) {
    assert.ok(
      message.includes(
        `website component source \`${relativePath}\` is not classified by a matrix row`
      )
    );
  }
});

test('excludes component test and spec fixtures from static classification', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const relativePath of [
    'apps/www/src/components/Widget.test.astro',
    'apps/www/src/components/Widget.spec.vue',
    'apps/www/src/components/Widget.test.svelte',
  ]) {
    const sourcePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, '<div>Fixture only</div>');
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('restricts Lucide component allowances to the Lucide package family', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const sourcePath of [
    'apps/www/src/components/LucideIconGallery.astro',
    'apps/www/src/components/StaticLucideIcon.astro',
  ]) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      ['---', "import { basePrototypes } from '@proto.ui/prototypes-base';", '---'].join('\n')
    );
  }
  const message = validationMessage(root);
  assert.match(
    message,
    /raw Proto UI import `@proto\.ui\/prototypes-base` in `apps\/www\/src\/components\/LucideIconGallery\.astro`/
  );
  assert.match(
    message,
    /raw Proto UI import `@proto\.ui\/prototypes-base` in `apps\/www\/src\/components\/StaticLucideIcon\.astro`/
  );
});

test('accepts Lucide package root and subpath imports in reviewed Lucide components', () => {
  const root = createRoot();
  writeValidMatrices(root);
  for (const [sourcePath, specifier] of [
    ['apps/www/src/components/LucideIconGallery.astro', '@proto.ui/prototypes-lucide'],
    ['apps/www/src/components/StaticLucideIcon.astro', '@proto.ui/prototypes-lucide/check'],
  ]) {
    const absolutePath = path.join(root, sourcePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, ['---', `import icon from '${specifier}';`, '---'].join('\n'));
  }
  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
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

test('loads quoted catalog scalars and the governed default draft status', () => {
  const quotedRoot = createRoot();
  fs.writeFileSync(
    path.join(quotedRoot, 'spec', 'fixtures', 'quoted.yml'),
    'id: "P-QUOTED-BUTTON"\ntype: "fixture"\nstatus: "active"\n',
    'utf8'
  );
  writeValidMatrices(quotedRoot, {
    'Proto UI chain': 'P-QUOTED-BUTTON',
    Lifecycle: 'P-QUOTED-BUTTON=active',
  });
  assert.deepEqual(validateCoverageMatrices({ rootDir: quotedRoot }), { matrixCount: 2 });

  const defaultRoot = createRoot();
  fs.writeFileSync(
    path.join(defaultRoot, 'spec', 'fixtures', 'default-status.yaml'),
    'id: P-DEFAULT-BUTTON\ntype: fixture\n',
    'utf8'
  );
  writeValidMatrices(defaultRoot, {
    'Proto UI chain': 'P-DEFAULT-BUTTON',
    Lifecycle: 'P-DEFAULT-BUTTON=draft',
    State: 'blocked',
    'Dependency and owner': '#420; owner: website team',
  });
  assert.deepEqual(validateCoverageMatrices({ rootDir: defaultRoot }), { matrixCount: 2 });
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

test('rejects removed catalog entities from every shipped Website state', () => {
  const cases = [
    {
      State: 'ready',
    },
    {
      State: 'self-hosted',
    },
    {
      ID: 'www.shell.site-title',
      Path: '`apps/www/src/components/override/SiteTitle.astro`',
      'Target class': 'native/static',
      State: 'native/static',
      'Dependency and owner': 'No Proto UI dependency; owner: website team',
      'Escape or exemption': 'Reason: native semantics remain the complete information path',
      'Re-review or removal issue': '#420 if application-owned interaction is introduced',
    },
    {
      ID: 'www.demo.brutalist-theme-style',
      Path: '`apps/www/src/components/BrutalistPageStyle.astro`',
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Dependency and owner': 'No Proto UI dependency; owner: website demos',
      'Escape or exemption': 'Reason: static theme infrastructure remains bounded to demos',
      'Re-review or removal issue': '#420 if the theme gains interaction state',
    },
  ];

  for (const overrides of cases) {
    const root = createRoot();
    writeValidMatrices(root, {
      'Proto UI chain': 'P-REMOVED-BUTTON',
      Lifecycle: 'P-REMOVED-BUTTON=removed',
      ...overrides,
    });
    assert.match(
      validationMessage(root),
      new RegExp(
        `shipped website State \`${overrides.State}\` must not consume removed catalog entities: \`P-REMOVED-BUTTON\``
      )
    );
  }
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

test('rejects self-hosted website rows backed only by prose evidence', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: 'Browser checks passed',
  });

  assert.match(
    validationMessage(root),
    /self-hosted rows must bind an exact internal\/website\/evidence\/\*\* path in Evidence/
  );
});

test('rejects self-hosted website evidence without every closeout dimension', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(absoluteEvidencePath, 'Build: passed\n', 'utf8');
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  const message = validationMessage(root);
  assert.match(message, /self-hosted evidence record .* missing required `Accessibility:` label/);
  assert.match(message, /self-hosted evidence record .* missing required `Screenshot:` label/);
  assert.match(message, /self-hosted evidence record .* missing required `Multi-frame:` label/);
});

test('rejects self-hosted website evidence without an exact commit SHA', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({ Commit: 'not-an-exact-sha' }),
    'utf8'
  );
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.match(
    validationMessage(root),
    /self-hosted evidence record .* must bind Commit to an exact 40-character Git SHA/
  );
});

test('rejects a missing self-hosted website evidence artifact', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/missing-closeout.md';
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.ok(
    validationMessage(root).includes(
      `Evidence references missing repository path \`${evidencePath}\``
    )
  );
});

test('rejects empty acceptance dimensions in self-hosted website evidence', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({ Screenshot: '—' }),
    'utf8'
  );
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.match(
    validationMessage(root),
    /self-hosted evidence record .* required `Screenshot:` label must have a meaningful value/
  );
});

test('rejects vacuous self-hosted website evidence labels without reproducible artifacts', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(
    absoluteEvidencePath,
    validSelfHostedWebsiteEvidence({
      Routes: 'ok',
      Build: 'ok',
      Browser: 'ok',
      Accessibility: 'ok',
      Screenshot: 'ok',
      'Multi-frame': 'ok',
      Commands: 'ok',
      Results: 'ok',
    }),
    'utf8'
  );
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  const message = validationMessage(root);
  assert.match(message, /Routes: must name at least one exact `\/route\/`/);
  assert.match(message, /Commands: must name at least one executable command in inline code/);
  for (const label of [
    'Build:',
    'Browser:',
    'Accessibility:',
    'Screenshot:',
    'Multi-frame:',
    'Results:',
  ]) {
    assert.ok(
      message.includes(
        `${label} must bind an exact retained artifact under internal/website/evidence/**`
      )
    );
  }
});

test('rejects mislabeled screenshots and canonically duplicate multi-frame manifests', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  writeSelfHostedWebsiteArtifacts(root);
  fs.writeFileSync(
    path.join(root, 'internal/website/evidence/s14/home-desktop.png'),
    'not an image',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'internal/website/evidence/s14/navigation-frames.json'),
    JSON.stringify({
      frames: [
        'internal/website/evidence/s14/navigation-before.png',
        'internal/website/evidence/s14/nested/../navigation-before.png',
      ],
    }),
    'utf8'
  );
  fs.writeFileSync(absoluteEvidencePath, validSelfHostedWebsiteEvidence(), 'utf8');
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  const message = validationMessage(root);
  assert.match(message, /Screenshot: retained artifact must be a recognized image file/);
  assert.match(
    message,
    /Multi-frame: JSON manifest must retain at least two canonically distinct frame paths/
  );
});

test('rejects fake images and traversal in multi-frame manifests', () => {
  for (const mode of ['fake-images', 'traversal']) {
    const root = createRoot();
    const evidencePath = 'internal/website/evidence/s14/closeout.md';
    writeSelfHostedWebsiteArtifacts(root);
    const manifestPath = path.join(root, 'internal/website/evidence/s14/navigation-frames.json');
    if (mode === 'fake-images') {
      fs.writeFileSync(
        path.join(root, 'internal/website/evidence/s14/navigation-before.png'),
        'fake before',
        'utf8'
      );
      fs.writeFileSync(
        path.join(root, 'internal/website/evidence/s14/navigation-after.png'),
        'fake after',
        'utf8'
      );
    } else {
      const outsidePath = path.join(root, 'internal/website/outside.png');
      fs.copyFileSync(
        path.join(root, 'internal/website/evidence/s14/navigation-after.png'),
        outsidePath
      );
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          frames: [
            'internal/website/evidence/s14/navigation-before.png',
            'internal/website/evidence/s14/../../outside.png',
          ],
        }),
        'utf8'
      );
    }
    fs.writeFileSync(path.join(root, evidencePath), validSelfHostedWebsiteEvidence(), 'utf8');
    writeValidMatrices(root, { State: 'self-hosted', Evidence: `\`${evidencePath}\`` });

    const message = validationMessage(root);
    if (mode === 'fake-images') {
      assert.match(message, /Multi-frame: JSON manifest frame must be a recognized image file/);
    } else {
      assert.match(
        message,
        /Multi-frame: JSON manifest frame must be an existing retained artifact under internal\/website\/evidence\/\*\*/
      );
    }
  }
});

test('accepts reproducible multi-dimensional evidence for a self-hosted website row', () => {
  const root = createRoot();
  const evidencePath = 'internal/website/evidence/s14/closeout.md';
  const absoluteEvidencePath = path.join(root, evidencePath);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  writeSelfHostedWebsiteArtifacts(root);
  fs.writeFileSync(absoluteEvidencePath, validSelfHostedWebsiteEvidence(), 'utf8');
  writeValidMatrices(root, {
    State: 'self-hosted',
    Evidence: `\`${evidencePath}\``,
  });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
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

test('requires a concrete dependency owner for every blocked or research row', () => {
  for (const state of ['blocked', 'research']) {
    const root = createRoot();
    writeValidMatrices(root, {}, { State: state, 'Dependency and owner': '#519' });
    assert.match(
      validationMessage(root),
      new RegExp(`${state} rows must give the .*label a concrete value`)
    );
  }
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

test('rejects Website difficulty values outside F1 through F5', () => {
  const root = createRoot();
  writeValidMatrices(root, { Difficulty: 'F13' });
  assert.match(
    validationMessage(root),
    /unsupported Difficulty `F13`; allowed: F1, F2, F3, F4, F5/
  );
});

test('rejects empty Website host and rendering strategy values', () => {
  const root = createRoot();
  writeValidMatrices(root, { 'WC host and SSR/no-JS strategy': 'WC:; SSR:; no-JS:' });
  const message = validationMessage(root);
  for (const label of ['WC:', 'SSR:', 'no-JS:']) {
    assert.ok(message.includes(`required \`${label}\` label must have a meaningful value`));
  }
});

test('does not let an empty Website strategy consume the next required label', () => {
  const root = createRoot();
  writeValidMatrices(root, {
    'WC host and SSR/no-JS strategy':
      'WC: SSR: meaningful light DOM remains; no-JS: native link remains',
  });
  assert.match(validationMessage(root), /required `WC:` label must have a meaningful value/);
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

test('rejects empty Harness state, event, host, and equivalence values', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'App state and semantic events': 'App state:; Events:',
      'Production host and equivalence evidence': 'Host:; WC:; React:; Vue:',
    }
  );
  const message = validationMessage(root);
  for (const label of ['App state:', 'Events:', 'Host:', 'WC:', 'React:', 'Vue:']) {
    assert.ok(message.includes(`required \`${label}\` label must have a meaningful value`));
  }
});

test('rejects punctuated placeholder values in Harness policy labels', () => {
  const root = createRoot();
  writeValidMatrices(
    root,
    {},
    {
      'App state and semantic events': 'App state: none.; Events: n/a.',
      'Production host and equivalence evidence': 'Host: none.; WC: n/a.; React: none.; Vue: n/a.',
    }
  );
  const message = validationMessage(root);
  for (const label of ['App state:', 'Events:', 'Host:', 'WC:', 'React:', 'Vue:']) {
    assert.ok(message.includes(`required \`${label}\` label must have a meaningful value`));
  }
});

test('requires app-local-proto state to retain the app-local target class', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { 'Target class': 'composition', State: 'app-local-proto' });
  assert.match(
    validationMessage(root),
    /State `app-local-proto` requires Target class `app-local-proto`, received `composition`/
  );
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
        ? 'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: tool invocation\nCommands: pnpm test\nResults: passed\n'
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

test('requires dogfooded Harness evidence to bind an exact 40-character Git SHA', () => {
  for (const commit of ['latest', 'abc123']) {
    const root = createRoot();
    const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
    const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
    for (const [repositoryPath, content] of [
      [implementationPath, 'fixture'],
      [
        evidencePath,
        `Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: ${commit}\nEnvironment: fixture\nFixtures: tool invocation\nCommands: pnpm test\nResults: passed\n`,
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
        Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
        'Dependency and owner': 'No blocker; owner: Harness application',
      }
    );
    assert.match(
      validationMessage(root),
      /dogfooded evidence record .* must bind Commit to an exact 40-character Git SHA/
    );
  }
});

test('requires a dogfooded implementation path under the Harness application root', () => {
  const root = createRoot();
  const implementationPath = 'spec/fixtures/not-harness.ts';
  const evidencePath = 'internal/agent-harness/evidence/m1/wrong-root.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: wrong root\nCommands: pnpm test\nResults: passed\n',
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
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );
  assert.match(
    validationMessage(root),
    /dogfooded rows must bind at least one existing implementation file under apps\/agent-harness\//
  );
});

test('requires dogfooded Harness implementation paths to bind regular files', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run';
  const evidencePath = 'internal/agent-harness/evidence/m1/run.md';
  fs.mkdirSync(path.join(root, implementationPath), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, evidencePath),
    'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: run\nCommands: pnpm test\nResults: passed\n',
    'utf8'
  );
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
  assert.match(message, /dogfooded implementation path must be a file/);
  assert.match(
    message,
    /dogfooded rows must bind at least one existing implementation file under apps\/agent-harness\//
  );
});

test('rejects dogfooded Harness rows that consume removed catalog entities', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/RemovedButton.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/removed-button.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: 0123456789abcdef0123456789abcdef01234567\nEnvironment: fixture\nFixtures: removed button\nCommands: pnpm test\nResults: passed\n',
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

test('requires newly exported Harness user-facing surfaces to have a matrix disposition', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const relativePath = 'apps/agent-harness/src/run/NewRunSummary.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function NewRunSummary() { return <section>Run summary</section>; }',
    'utf8'
  );

  assert.match(
    validationMessage(root),
    /Harness user-facing source `apps\/agent-harness\/src\/run\/NewRunSummary\.tsx` is not classified by a matrix row or Source-scan binding/
  );
});

test('discovers exported Harness surfaces rendered with React.createElement', () => {
  const root = createRoot();
  writeValidMatrices(root);
  const cases = [
    [
      'apps/agent-harness/src/run/ClassicRunSummary.ts',
      "import * as React from 'react'; export function ClassicRunSummary() { return React.createElement('section', null, 'Run summary'); }",
    ],
    [
      'apps/agent-harness/src/run/AliasedRunSummary.js',
      "import { createElement as h } from 'react'; export const AliasedRunSummary = () => h('section', null, 'Run summary');",
    ],
  ];
  for (const [relativePath, content] of cases) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  const message = validationMessage(root);
  for (const [relativePath] of cases) {
    assert.ok(
      message.includes(
        `Harness user-facing source \`${relativePath}\` is not classified by a matrix row or Source-scan binding`
      )
    );
  }
});

test('allows an exported Harness surface to reuse a row through an explicit source binding', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/NewRunSummary.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function NewRunSummary() { return <section>Run summary</section>; }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    {
      harnessBindings: [[relativePath, ['harness.transcript.viewport']]],
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('accepts a Harness user-facing source directly owned by a matrix Path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RunSummary.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function RunSummary() { return <section>Run summary</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('accepts a planned Harness source directly owned by an exact plain-text matrix Path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/app/AppShell.tsx';
  const absolutePath = path.join(root, relativePath);
  writeValidMatrices(root, {}, { ID: 'harness.shell.frame', Path: relativePath });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AppShell() { return <main>Harness</main>; }',
    'utf8'
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not treat prose containing a Harness path as a direct matrix Path owner', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/app/AppShell.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AppShell() { return <main>Harness</main>; }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.shell.frame',
      Path: `Planned implementation: ${relativePath}`,
    }
  );

  assert.match(
    validationMessage(root),
    /Harness user-facing source `apps\/agent-harness\/src\/app\/AppShell\.tsx` is not classified/
  );
});

test('rejects forbidden interaction state machines in ordinary Harness sources', () => {
  const cases = [
    ['RawKeyboard.tsx', 'export const RawKeyboard = () => <div onKeyDown={() => {}}>x</div>;'],
    [
      'RawCreateElement.ts',
      "import { createElement as h } from 'react'; export const Raw = () => h('div', { onPointerDown: dismiss });",
    ],
    ['Listener.ts', 'window.addEventListener("pointerdown", dismiss);'],
    ['Focus.ts', 'const element = document.querySelector("button"); element?.focus();'],
    ['Scroll.ts', 'const element = document.querySelector("main"); element?.scrollIntoView();'],
    [
      'Aria.ts',
      'const element = document.querySelector("button"); element?.setAttribute("aria-expanded", "true");',
    ],
    [
      'ClassMutation.ts',
      'const element = document.querySelector("div"); element?.classList.toggle("open");',
    ],
    ['Observer.ts', 'const observer = new ResizeObserver(reflow);'],
  ];

  for (const [fileName, content] of cases) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${fileName}`;
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.ok(
      validationMessage(root).includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      )
    );
  }
});

test('rejects governed DOM state property assignments on bounded receivers', () => {
  const cases = [
    ['ScrollTop', 'scrollTop', '+=', false],
    ['ScrollLeft', 'scrollLeft', '=', true],
    ['InputValue', 'value', '=', false],
    ['SelectionStart', 'selectionStart', '=', true],
    ['SelectionEnd', 'selectionEnd', '=', false],
    ['SelectionDirection', 'selectionDirection', '=', true],
  ];
  for (const [stem, property, operator, elementAccess] of cases) {
    const root = createRoot();
    const relativePath = `apps/agent-harness/src/run/${stem}.ts`;
    const absolutePath = path.join(root, relativePath);
    const propertyAccess = elementAccess ? `["${property}"]` : `.${property}`;
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      `const element = document.querySelector("input"); element${propertyAccess} ${operator} next;`,
      'utf8'
    );
    writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

    assert.ok(
      validationMessage(root).includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      ),
      `${property} assignment must remain protected by the Harness forbidden-state scan`
    );
  }
});

test('does not treat domain-model property assignments as DOM state machines', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/DomainState.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function update(model) { model.value = "ready"; model.scrollTop += 1; model.selectionStart = 0; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects bounded event receiver aliases and native JSX handler spreads in every script extension', () => {
  for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
    for (const [stem, content] of [
      ['CurrentTargetFocus', 'export function focusCurrent(ev) { ev.currentTarget.focus(); }'],
      [
        'NativeHandlerSpread',
        'const onKeyDown = () => {}; const handlers = { onKeyDown }; export const Raw = () => <div {...handlers}>raw</div>;',
      ],
    ]) {
      const root = createRoot();
      const relativePath = `apps/agent-harness/src/run/${stem}.${extension}`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, 'utf8');
      writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

      assert.ok(
        validationMessage(root).includes(
          `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
        ),
        `${relativePath} must remain protected by the Harness forbidden-state scan`
      );
    }
  }
});

test('follows lexical aliases for native JSX handler spread objects', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AliasedNativeHandlers.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const onKeyDown = run; const handlers = { onKeyDown }; const alias = handlers; export const Raw = () => <div {...alias}>raw</div>;',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('follows plain identifier assignment flow for native JSX handler spreads', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AssignedNativeHandlers.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const onKeyDown = run; let handlers; handlers = { onKeyDown }; export const Raw = () => <div {...handlers}>raw</div>;',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.ok(
    validationMessage(root).includes(
      `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
    )
  );
});

test('does not treat compound, property, or inner-scope assignments as outer object bindings', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/NonPlainAssignments.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      'const onKeyDown = run;',
      'let compound = {}; compound ||= { onKeyDown };',
      'let property = {}; property.handlers = { onKeyDown };',
      'let scoped = {}; function mutate() { scoped = { onKeyDown }; }',
      'export const Safe = () => <><div {...compound}/><div {...property}/><div {...scoped}/></>;',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not let function-like parameters hide later outer native handler spreads', () => {
  for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
    for (const [stem, shadowDeclaration] of [
      ['Function', 'function Safe(handlers) { return <div {...handlers}>safe</div>; }'],
      ['Arrow', 'const Safe = (handlers) => <div {...handlers}>safe</div>;'],
    ]) {
      const root = createRoot();
      const relativePath = `apps/agent-harness/src/run/OuterHandlersAfter${stem}.${extension}`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(
        absolutePath,
        `const onKeyDown = run; const handlers = { onKeyDown }; ${shadowDeclaration} export const Raw = () => <div {...handlers}>raw</div>;`,
        'utf8'
      );
      writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

      assert.ok(
        validationMessage(root).includes(
          `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
        ),
        `${relativePath} must resolve the outer handler binding after the function-like shadow`
      );
    }
  }
});

test('lets a function parameter shadow an outer native handler object', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/ShadowedNativeHandlers.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'const onKeyDown = run; const handlers = { onKeyDown }; export function Safe(handlers) { return <div {...handlers}>safe</div>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: `\`${relativePath}\`` });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not permit a forbidden Harness state machine merely because it is bound to any row', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RawKeyboardHelper.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'document.onkeydown = handleKeyDown;', 'utf8');
  writeValidMatrices(
    root,
    {},
    {},
    {
      harnessBindings: [[relativePath, ['harness.transcript.viewport']]],
    }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/RawKeyboardHelper\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('allows bounded interaction mechanics only for an exact infrastructure-exempt Harness disposition', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/infrastructure/viewport-engine.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'const observer = new ResizeObserver(reflow);', 'utf8');
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: `\`${relativePath}\``,
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption':
        'Reason: bounded viewport observation is infrastructure; limit: this exact source only',
      'Re-review or removal issue': '#533 if it owns surrounding controls or focus behavior',
    }
  );

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('does not let an infrastructure binding exempt a forbidden unrelated source', () => {
  const root = createRoot();
  const exemptPath = 'apps/agent-harness/src/infrastructure/viewport-engine.ts';
  const rawPath = 'apps/agent-harness/src/run/raw-focus.ts';
  fs.mkdirSync(path.join(root, 'apps', 'agent-harness', 'src', 'run'), { recursive: true });
  fs.writeFileSync(
    path.join(root, rawPath),
    'export function focusCurrent(ev) { ev.currentTarget.focus(); }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: `\`${exemptPath}\``,
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption':
        'Reason: bounded viewport observation is infrastructure; limit: this exact source only',
      'Re-review or removal issue': '#533 if it owns surrounding controls or focus behavior',
    },
    {
      harnessBindings: [[rawPath, ['harness.infrastructure.viewport-engine']]],
    }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/raw-focus\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('requires a source-exact limit before an infrastructure row exempts forbidden mechanics', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/infrastructure/viewport-engine.ts';
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(root, relativePath), 'new ResizeObserver(reflow);', 'utf8');
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: `\`${relativePath}\``,
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption': 'Reason: bounded viewport observation is infrastructure only',
      'Re-review or removal issue': '#533 when the viewport policy changes',
    }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/infrastructure\/viewport-engine\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('does not apply this-exact-source infrastructure prose to multiple Path sources', () => {
  const root = createRoot();
  const sourcePaths = [
    'apps/agent-harness/src/infrastructure/viewport-engine.ts',
    'apps/agent-harness/src/infrastructure/focus-engine.ts',
  ];
  for (const relativePath of sourcePaths) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'new ResizeObserver(reflow);', 'utf8');
  }
  writeValidMatrices(
    root,
    {},
    {
      ID: 'harness.infrastructure.viewport-engine',
      Path: sourcePaths.map((sourcePath) => `\`${sourcePath}\``).join(', '),
      'Target class': 'infrastructure-exempt',
      State: 'infrastructure-exempt',
      'Proto UI chain': 'No catalog entity required by the infrastructure exemption',
      'Dependency and owner': '#533; owner: Harness infrastructure owner',
      'Escape or exemption':
        'Reason: bounded viewport observation is infrastructure; limit: this exact source only',
      'Re-review or removal issue': '#533 when the viewport policy changes',
    }
  );

  const message = validationMessage(root);
  for (const relativePath of sourcePaths) {
    assert.ok(
      message.includes(
        `Harness source \`${relativePath}\` contains a forbidden interaction or DOM state machine`
      )
    );
  }
});

test('ignores Harness tests, strings, comments, and semantic component callbacks', () => {
  const root = createRoot();
  const sourceRoot = path.join(root, 'apps', 'agent-harness', 'src', 'run');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, 'Safe.tsx'),
    [
      'const example = "element.scrollIntoView(); window.addEventListener(\\"keydown\\", fn)";',
      '// element.focus(); new MutationObserver(fn);',
      'const onKeyDown = requestAction;',
      'const handlers = { onKeyDown };',
      'export const Safe = () => <><ProtoButton {...handlers}>Run</ProtoButton><Composer onSubmit={send} /><Button onPress={approve} /></>;',
      'export function Shadowed() {',
      '  const handlers = { role: "button" };',
      '  return <div {...handlers}>Static</div>;',
      '}',
      'export function DomainModel(model) { model.currentTarget.focus(); }',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'RawKeyboard.test.tsx'),
    'export const Fixture = () => <div onKeyDown={() => {}}>fixture</div>;',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: '`apps/agent-harness/src/run/Safe.tsx`' });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
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

test('loads catalog entities from both YAML extensions', () => {
  const root = createRoot();
  const catalogPath = path.join(root, 'spec', 'fixtures', 'YmlEntity.yml');
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, 'id: P-YML-ENTITY\nstatus: active\n', 'utf8');
  writeValidMatrices(root, {
    'Proto UI chain': 'P-YML-ENTITY',
    Lifecycle: 'P-YML-ENTITY=active',
  });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('rejects guarded Less imports with option lists', () => {
  const root = createRoot();
  for (const [relativePath, content] of [
    ['apps/www/src/styles/Optioned.less', '@import (reference) "@proto.ui/runtime/styles.less";'],
    [
      'apps/agent-harness/src/run/Optioned.less',
      '@import (reference, once) "@proto.ui/runtime/styles.less";',
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root);

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime/styles.less` in `apps/www/src/styles/Optioned.less`'
    )
  );
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime/styles.less` in `apps/agent-harness/src/run/Optioned.less`'
    )
  );
});

test('rejects forbidden Harness interaction sources outside infrastructure disposition', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RawState.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function ownState(element) { window.addEventListener("keydown", () => {}); element.focus(); }',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/RawState\.ts` contains a forbidden interaction or DOM state machine/
  );
});

test('reuses a planned Harness row from its plain-text Path', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/app/AppShell.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AppShell() { return <section>Harness</section>; }',
    'utf8'
  );
  writeValidMatrices(root, {}, { Path: relativePath });

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('ignores indented Markdown code examples during interaction and import scans', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/indented-examples.mdx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    [
      '# Examples',
      '',
      '    import "@proto.ui/runtime/styles";',
      '    button.addEventListener("click", activate);',
    ].join('\n'),
    'utf8'
  );
  writeValidMatrices(root);

  assert.deepEqual(validateCoverageMatrices({ rootDir: root }), { matrixCount: 2 });
});

test('classifies exported factory-rendered Website components', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/FactorySurface.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import * as React from 'react'; export function FactorySurface() { return React.createElement('section', null, 'Surface'); }",
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/components\/FactorySurface\.ts` is not classified by a matrix row/
  );
});

test('requires exact commit SHAs in dogfooded Harness evidence records', () => {
  const root = createRoot();
  const implementationPath = 'apps/agent-harness/src/run/ToolInvocation.tsx';
  const evidencePath = 'internal/agent-harness/evidence/m1/tool-invocation.md';
  for (const [repositoryPath, content] of [
    [implementationPath, 'fixture'],
    [
      evidencePath,
      'Build: passed\nBrowser: passed\nAccessibility: passed\nLifecycle: passed\nDesign: Brutalist\nCommit: latest\nEnvironment: fixture\nFixtures: tool invocation\nCommands: pnpm test\nResults: passed\n',
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
      Evidence: `Build: passed; Browser: passed; Accessibility: passed; Lifecycle: passed; Design: Brutalist; \`${evidencePath}\``,
      'Dependency and owner': 'No blocker; owner: Harness application',
    }
  );

  assert.match(
    validationMessage(root),
    /dogfooded evidence record .* must bind Commit to an exact 40-character Git SHA/
  );
});

test('requires named owners on blocked and research rows', () => {
  const root = createRoot();
  writeValidMatrices(root, {}, { State: 'research', 'Dependency and owner': '#515' });

  assert.match(
    validationMessage(root),
    /research rows must give the `owner:` or `owners:` label a concrete value in Dependency and owner/
  );
});

test('classifies Vite query imports by their base specifier', () => {
  const root = createRoot();
  for (const [relativePath, content] of [
    [
      'apps/www/src/components/QueryImport.astro',
      '---\nimport value from "@proto.ui/runtime?raw";\n---\n<div>{value}</div>',
    ],
    [
      'apps/agent-harness/src/run/QueryImport.ts',
      'import value from "@proto.ui/adapter-react?url"; export const query = value;',
    ],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  writeValidMatrices(root);

  const message = validationMessage(root);
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/runtime?raw` in `apps/www/src/components/QueryImport.astro`'
    )
  );
  assert.ok(
    message.includes(
      'raw Proto UI import `@proto.ui/adapter-react?url` in `apps/agent-harness/src/run/QueryImport.ts`'
    )
  );
});

test('rejects forbidden third-party Harness UI package imports', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/RadixDialog.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    "import * as Dialog from '@radix-ui/react-dialog'; export const primitive = Dialog.Root;",
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /forbidden third-party Harness UI package `@radix-ui\/react-dialog`/
  );
});

test('guards the privileged hooks package in Website consumers', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/HookEscape.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, "import { useContext } from '@proto.ui/hooks';", 'utf8');
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /raw Proto UI import `@proto\.ui\/hooks` in `apps\/www\/src\/components\/HookEscape\.ts`/
  );
});

test('detects destructured DOM receivers in Website interactions', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/destructured-focus.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function focusCurrent(inputRef) { const { current: input } = inputRef; input.focus(); }',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/src\/content\/docs\/destructured-focus\.ts` is not bound/
  );
});

test('rejects Agent actions from Harness render effects', () => {
  const root = createRoot();
  const relativePath = 'apps/agent-harness/src/run/AutoApprove.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function AutoApprove({ id }) { useEffect(() => approve(id), [id]); return <main>Run</main>; }',
    'utf8'
  );
  writeValidMatrices(
    root,
    {},
    {},
    { harnessBindings: [[relativePath, ['harness.transcript.viewport']]] }
  );

  assert.match(
    validationMessage(root),
    /Harness source `apps\/agent-harness\/src\/run\/AutoApprove\.tsx` contains a forbidden interaction or DOM state machine/
  );
});

test('scans executable Website scripts under public assets', () => {
  const root = createRoot();
  const relativePath = 'apps/www/public/raw-navigation.js';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'window.addEventListener("keydown", navigate);', 'utf8');
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /interactive website source `apps\/www\/public\/raw-navigation\.js` is not bound/
  );
});

test('inspects Vite glob imports at the Website consumer wall', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/GlobEscape.ts';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export const modules = import.meta.glob("../../../../packages/runtime/src/**");',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /raw Proto UI import `\.\.\/\.\.\/\.\.\/\.\.\/packages\/runtime\/src\/\*\*` in `apps\/www\/src\/components\/GlobEscape\.ts`/
  );
});

test('discovers static components co-located with Website documentation', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/content/docs/Callout.tsx';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    'export function Callout() { return <aside>Note</aside>; }',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /website component source `apps\/www\/src\/content\/docs\/Callout\.tsx` is not classified/
  );
});

test('inspects external Astro script src module paths', () => {
  const root = createRoot();
  const relativePath = 'apps/www/src/components/ExternalScriptEscape.astro';
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    '<script src="../../../../packages/runtime/src/index.ts"></script>',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /raw Proto UI import `\.\.\/\.\.\/\.\.\/\.\.\/packages\/runtime\/src\/index\.ts` in `apps\/www\/src\/components\/ExternalScriptEscape\.astro`/
  );
});

test('canonicalizes symlinked Website import targets', () => {
  const root = createRoot();
  const runtimeRoot = path.join(root, 'packages', 'runtime', 'src');
  const symlinkRoot = path.join(root, 'apps', 'www', 'src', 'vendor');
  const sourcePath = 'apps/www/src/components/SymlinkEscape.ts';
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(symlinkRoot, { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, 'escape.ts'), 'export const escape = true;', 'utf8');
  fs.symlinkSync(runtimeRoot, path.join(symlinkRoot, 'runtime'), 'dir');
  const absoluteSourcePath = path.join(root, sourcePath);
  fs.mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  fs.writeFileSync(
    absoluteSourcePath,
    'import { escape } from "../vendor/runtime/escape";',
    'utf8'
  );
  writeValidMatrices(root);

  assert.match(
    validationMessage(root),
    /raw Proto UI import `\.\.\/vendor\/runtime\/escape` in `apps\/www\/src\/components\/SymlinkEscape\.ts`/
  );
});
