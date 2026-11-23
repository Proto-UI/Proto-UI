import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createProcessor } from '@mdx-js/mdx';
import { tsImport } from 'tsx/esm/api';
import ts from 'typescript';
import { buildReleaseWebsiteInventory } from './release-website-inventory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RECORD = 'internal/records/2026-11-22-sprint3-website-readiness.json';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const CATEGORIES = {
  'disabled-without-code': 'Supply matching public Usage; no CodeExample or fenced code exists.',
  'disabled-with-fenced-code':
    'Reuse the authored code and complete missing host/setup/preview correspondence.',
  'enabled-without-source':
    'Supply matching source; enabling codePanel alone does not produce Code.',
  'preview-source-unverified':
    'Review and execute the existing source for every declared host; presence is not acceptance.',
  'code-example-unverified':
    'Execute the displayed complete files against the declared installed version and real Preview.',
  'no-preview-or-source':
    'Resolve the actual public demonstration and Usage obligation explicitly.',
};

/** Read only exported literal identities. Never execute a snippet to discover its keys. */
export function inspectCodeMap(source, file = 'code.ts') {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (tree.parseDiagnostics.length) throw new Error(`Invalid Code module: ${file}`);
  const key = (node) => {
    if (node && (ts.isIdentifier(node) || ts.isStringLiteral(node))) return node.text;
    throw new Error(`Computed or unsupported Code identity in ${file}.`);
  };
  const object = (node) => {
    while (
      node &&
      (ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isParenthesizedExpression(node))
    )
      node = node.expression;
    if (!node || !ts.isObjectLiteralExpression(node))
      throw new Error(`Nonliteral Code map in ${file}.`);
    return node;
  };
  const entries = [];
  for (const statement of tree.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'codeMap') continue;
      for (const host of object(declaration.initializer).properties) {
        if (!ts.isPropertyAssignment(host))
          throw new Error(`Spread or shorthand Code host in ${file}.`);
        for (const demo of object(host.initializer).properties) {
          if (!ts.isPropertyAssignment(demo))
            throw new Error(`Spread or shorthand Code demo in ${file}.`);
          entries.push({ file, host: key(host.name), demoId: key(demo.name) });
        }
      }
    }
  }
  return entries;
}

export function indexCodeMaps(modules) {
  const byDemo = new Map();
  for (const { file, entries } of modules)
    for (const entry of entries) {
      const existing = byDemo.get(entry.demoId);
      // PrototypePreviewer returns the first matching module, not a union of
      // partial hosts. Ambiguous modules cannot manufacture complete coverage.
      if (existing && existing.file !== file)
        throw new Error(`Duplicate Code source for ${entry.demoId}.`);
      const record = existing ?? { file, hosts: [] };
      if (record.hosts.includes(entry.host))
        throw new Error(`Duplicate Code host for ${entry.demoId}/${entry.host}.`);
      record.hosts.push(entry.host);
      byDemo.set(entry.demoId, record);
    }
  return byDemo;
}

export function inspectUsageSource(source) {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (value) =>
    value.replace(/[^\r\n]/g, '')
  );
  const tree = createProcessor({ format: 'mdx' }).parse(body);
  const explicitCodeLines = [];
  const visit = (node) => {
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const code = node.attributes?.find((entry) => entry.name === 'code');
      if (code && (typeof code.value === 'string' ? code.value.trim() : code.value?.value?.trim()))
        explicitCodeLines.push(node.position.start.line);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return { explicitCodeLines };
}

export function classifyRoute(row, maps, usage = { explicitCodeLines: [] }) {
  const previews = row.document.previews.map((preview) => {
    const map = maps.get(preview.demoId);
    const explicit = usage.explicitCodeLines.includes(preview.line);
    const sourceHosts = preview.codePanel
      ? preview.runtimes.filter((host) => explicit || map?.hosts.includes(host))
      : [];
    return { ...preview, sourceHosts, codeMapFile: map?.file ?? null };
  });
  const allDisabled = previews.length > 0 && previews.every((preview) => !preview.codePanel);
  const category = row.document.codeExamples.length
    ? 'code-example-unverified'
    : previews.some((preview) => preview.sourceHosts.length)
      ? 'preview-source-unverified'
      : allDisabled
        ? row.document.inlineCodeBlocks
          ? 'disabled-with-fenced-code'
          : 'disabled-without-code'
        : previews.length
          ? 'enabled-without-source'
          : 'no-preview-or-source';
  return {
    category,
    previews,
    allDisabledWithoutCodeExample: allDisabled && row.document.codeExamples.length === 0,
    missingPreviewSourceHostCells: previews.reduce(
      (n, p) => n + p.runtimes.length - p.sourceHosts.length,
      0
    ),
    // This describes source declarations, including private/partial snippets.
    // It is deliberately never upgraded to runnable or native acceptance.
    acceptance: 'not-established',
  };
}

export function cliDisposition(row, publicRegistry, workspaceRegistry) {
  const imports = row.exports.map((name) => `@proto.ui/prototypes-${row.library}/${name.slice(2)}`);
  const entries = Object.values({ ...workspaceRegistry, ...publicRegistry }).filter((entry) =>
    imports.includes(entry.importPath)
  );
  const publicTargets = entries
    .filter((entry) => !entry.sourceOnly && publicRegistry[entry.id])
    .map((entry) => entry.id)
    .sort();
  return {
    kind: publicTargets.length
      ? 'public-target'
      : entries.length
        ? 'workspace-source-only'
        : 'no-component-target',
    targets: (publicTargets.length ? publicTargets : entries.map((entry) => entry.id)).sort(),
    installedAcceptance: 'not-established',
  };
}

function compactFamilies(rows, locales) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.library}:${row.family}`;
    groups.set(key, [...(groups.get(key) ?? []), row.locale]);
  }
  const families = [],
    localeRows = [];
  for (const [key, actual] of groups) {
    if (JSON.stringify([...actual].sort()) === JSON.stringify([...locales].sort()))
      families.push(key);
    else localeRows.push(...actual.map((locale) => `${key}:${locale}`));
  }
  return { routeCount: rows.length, families: families.sort(), localeRows: localeRows.sort() };
}

async function codeFiles(root) {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const file = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name.endsWith('Code.ts')) files.push(file);
    }
  };
  await visit('apps/www/src/content/docs/demo_components');
  return files.sort();
}

export async function buildWebsiteReadiness({ root = ROOT } = {}) {
  const inventory = await buildReleaseWebsiteInventory({ root });
  if (inventory.errors.length) throw new Error(inventory.errors.join('\n'));
  const inputs = new Map(inventory.inputs.map((entry) => [entry.path, entry]));
  const read = async (file) => {
    const bytes = await readFile(path.join(root, file));
    if (inputs.has(file) && inputs.get(file).sha256 !== hash(bytes))
      throw new Error(`Source changed during diagnosis: ${file}`);
    inputs.set(file, { path: file, sha256: hash(bytes) });
    return bytes.toString('utf8');
  };
  const modules = [];
  for (const file of await codeFiles(root)) {
    const source = await read(file);
    const entries = inspectCodeMap(source, file);
    if (entries.length)
      modules.push({ file, entries, containsWebsiteAlias: source.includes('@prototype-libs/') });
  }
  const maps = indexCodeMaps(modules);
  const { COMPONENT_REGISTRY, WORKSPACE_COMPONENT_REGISTRY } = await tsImport(
    './packages/cli/src/registry/components.ts',
    pathToFileURL(path.join(root, 'package.json')).href
  );
  const supportPaths = [
    'scripts/docs/release-website-inventory.mjs',
    'scripts/docs/release-website-readiness.mjs',
    'packages/cli/src/registry/components.ts',
    'packages/cli/src/registry/finf-components.ts',
    'packages/cli/src/registry/shadcn-component-presets.generated.ts',
    'apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro',
    'apps/www/src/components/PrototypePreviewer/previewer-client.ts',
    'apps/www/src/components/PrototypePreviewer/projected-previewer-client.ts',
    'apps/www/scripts/example_code_generation/cli.ts',
    'apps/www/scripts/example_code_generation/generate-code.ts',
    'apps/www/scripts/example_code_generation/prototype-config.ts',
    'apps/www/src/content/docs/demo_components/tooltip-usage.ts',
  ];
  for (const file of supportPaths) await read(file);
  const rows = [];
  for (const row of inventory.rows)
    rows.push({
      ...row,
      usage: classifyRoute(row, maps, inspectUsageSource(await read(row.source))),
      cli: cliDisposition(row, COMPONENT_REGISTRY, WORKSPACE_COMPONENT_REGISTRY),
    });
  const locales = [...new Set(rows.map((row) => row.locale))].sort();
  const sourceInputs = [...inputs.values()].sort((a, b) => a.path.localeCompare(b.path));
  const disabled = rows.filter((row) => row.usage.allDisabledWithoutCodeExample);
  const omitted = rows.filter(
    (row) =>
      row.document.previews.length &&
      inventory.runtimes.some(
        (host) => !row.document.previews.some((p) => p.runtimes.includes(host))
      )
  );
  const summary = {
    ...inventory.summary,
    codeMapFiles: modules.length,
    codeMapDemoIds: maps.size,
    codeMapHostEntries: modules.reduce((n, m) => n + m.entries.length, 0),
    disabledWithoutCodeExampleRoutes: disabled.length,
    disabledWithoutCodeExampleOrFenceRoutes: rows.filter(
      (r) => r.usage.category === 'disabled-without-code'
    ).length,
    missingPreviewSourceHostCells: rows.reduce(
      (n, row) => n + row.usage.missingPreviewSourceHostCells,
      0
    ),
    omittedHostRoutes: omitted.length,
    fullMatrixAcceptance: 'not-established',
  };
  const record = {
    schemaVersion: 1,
    kind: 'current-source-obligations; no product acceptance is earned by this ledger',
    observedCheckout: { revision: inventory.revision, dirty: inventory.dirty },
    source: {
      inputDigest: hash(JSON.stringify(sourceInputs)),
      inventoryInputDigest: inventory.inputDigest,
      inputFiles: sourceInputs.length,
      inputResolution:
        'Re-run with --details to recover every route source path and its exact input SHA-256; inputs include all MDX pages, package exports, policy, runtime list, Code modules, registry and inspected producers.',
      supportingInputs: sourceInputs.filter(
        (entry) => !inventory.inputs.some((original) => original.path === entry.path)
      ),
    },
    locales,
    familyKeyExpansion:
      'A family key expands to <family>:<locale> for every locale above; localeRows are additional exact inventory row IDs. Row.source in the existing inventory identifies the actual MD/MDX path, including policy aliases.',
    summary,
    historicalCounts: {
      original1042: {
        routes: 518,
        cells: 5784,
        status: 'original row matrix and runner not recovered; no replacement or acceptance',
      },
      priorCurrentInventory: {
        revision: '4e3406b9c8f594875fe5f272caa56501c2e2a226',
        integrationMapping: {
          'originalSourceCommit': '4e3406b9c8f594875fe5f272caa56501c2e2a226',
          'publishedIntegrationCommit': 'fbf691e1067ec90d0eea0548fe1db3205c475fc1',
          'reachableFromPublishedSource': '830287f95959a4a1a4fb797df68b0bd6889e0bae',
          'scope':
            'Changed source paths are byte-equal except the shared suite plan; these are mapped source slices, not identical complete checkouts or interchangeable native receipts.',
          'identicalPaths': [
            {
              'path': 'apps/www/src/components/CodeExample.astro',
              'sha256': 'ee411c8095f9be0dc5bc9877e10496b907b5d219286aba21b9190e979d23463a',
            },
            {
              'path': 'apps/www/src/components/InstallCommandCard.astro',
              'sha256': '638663a321bab63f998a4a6255f66c626c1de89b39047999593c8ea0f4c55f0c',
            },
            {
              'path': 'apps/www/src/components/PrototypePreviewer/CodePanel.astro',
              'sha256': 'f25f1b0ccd7faf348e2b32d8a3230d60c07c773ad981882c158ab8bb590edb30',
            },
            {
              'path': 'apps/www/src/components/code-example-nojs.test.ts',
              'sha256': '58e812cbc3ec64c32943f6b59e88e77b409286b42adb4cd1b16be132d45a93f5',
            },
            {
              'path': 'apps/www/src/components/install-command-card-client.test.ts',
              'sha256': 'b17ff99c16796e43cd0c119d63d954e56827f3a6cee170dc038bb8f80432c933',
            },
            {
              'path': 'apps/www/src/components/install-command-card-client.ts',
              'sha256': 'dd644892e2650c8c6978c8b5707692ace5cc68d680acf940ef65d3483aa8fb64',
            },
            {
              'path': 'apps/www/src/content/docs/en/ui-libraries/base/button.mdx',
              'sha256': '8be38da7de1a2a1dac3cecdf80df737fb43c3bcb85c334d591ae2b40b871535b',
            },
            {
              'path': 'apps/www/src/content/docs/en/ui-libraries/shadcn/button.mdx',
              'sha256': 'db6cdd111a3b2bfc69c4e42889daee6adee4b25ba48f9b1ef112c25591f0bed1',
            },
            {
              'path': 'apps/www/src/content/docs/zh-cn/ui-libraries/base/button.mdx',
              'sha256': 'bf936616c66d0d2b9fbb5352579949c2ce469e9e2a622985da70f3136b25c676',
            },
            {
              'path': 'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/button.mdx',
              'sha256': 'd22631b1ce4efd6aedaa8ea03de1e8507ff5ce3b76d5e4dc04d8b9337a5ff54f',
            },
            {
              'path': 'apps/www/test/release-docs-reading.browser.test.ts',
              'sha256': '6be1ed3cc2df60e00e74d63271f72bb9af75191df7c83b6a6fc7beb4b0dae72d',
            },
            {
              'path': 'internal/records/2026-11-22-sprint3-website-current-source.md',
              'sha256': 'abebe24d39df1092fcaaf2f189cf81b3dc74e078cea374e2a1607a92e69c90ef',
            },
            {
              'path': 'scripts/docs/README.md',
              'sha256': 'c559850bba738ff301d79f5605ee63bc4604723a5de0f0383bc43789a6d0023b',
            },
            {
              'path': 'scripts/docs/release-website-inventory.mjs',
              'sha256': 'b72c74b0d6a878eb4963c23249a9a7d56d7ce81d82ed4a55f85b4fd809f73522',
            },
            {
              'path': 'scripts/docs/test/release-website-inventory.test.mjs',
              'sha256': '5d2cd7e5c454f78566162079adf5560a96e5114079a7a296ee1e2033d5f70a6c',
            },
          ],
          'sharedSuitePlan': {
            'path': 'scripts/test/runtime-test-plan.mjs',
            'originalSha256': '099a7fa5b2b9b5322d1513420ed97b72a81d201fe32824d9717fb2730442b051',
            'integratedSha256': '7b48a411ade56ed4c94ce4b7897865c81bf4150fd57dcb7a074252602257bbcf',
            'retainedAdditionalSuite': 'packages/compiler/test/transition-native.browser.test.ts',
          },
        },
        routes: 340,
        previews: 450,
        previewHostCells: 1578,
        status: 'source enumeration only',
      },
      initialIncreaseTo1582: {
        sourceCommit: '5b8685717153c0b21ce15f220bd75f1e3f2e01ef',
        integrationMapping: {
          'originalSourceCommit': '5b8685717153c0b21ce15f220bd75f1e3f2e01ef',
          'publishedIntegrationCommit': '9c3a4d789e0144f98ac53bb73cd3a72907e2f6d8',
          'reachableFromPublishedSource': '830287f95959a4a1a4fb797df68b0bd6889e0bae',
          'scope':
            'Changed source paths are byte-equal except the shared suite plan; these are mapped source slices, not identical complete checkouts or interchangeable native receipts.',
          'identicalPaths': [
            {
              'path': 'apps/www/src/components/PrototypePreviewer/tooltip-registration.test.ts',
              'sha256': '4678fcc68c326f6a31123b4f183cc439b7ffc08ab4f1ec9616886286fccf57cd',
            },
            {
              'path': 'apps/www/src/content/docs/en/ui-libraries/base/tooltip.mdx',
              'sha256': '644983422d7b587825ccf6d17e94e3fbc37e46e825a6b73b61ec6722937c0a00',
            },
            {
              'path': 'apps/www/src/content/docs/en/ui-libraries/brutalist/components/tooltip.mdx',
              'sha256': '76c1aed32d70530b6c3f394713fe860560b090f9a1866f91be69956dc9a23e02',
            },
            {
              'path':
                'apps/www/src/content/docs/zh-cn/contrast-tooltip-warm-handoff.browser.test.ts',
              'sha256': '9fb113affb53f45b0745eea52197be167fb8ab6d7a64fe018cc99cc34053256a',
            },
            {
              'path': 'apps/www/src/content/docs/zh-cn/demo-base-tooltip.browser.test.ts',
              'sha256': '92dd23b8f542950974772152fcf51fc8d77e663e91e7cb966a830fb24a6ed917',
            },
            {
              'path': 'apps/www/src/content/docs/zh-cn/demo-base-tooltip.test.ts',
              'sha256': '2492c890767ff237729f05e53b420422335354bc9cd123ec03224f1cf16d1179',
            },
            {
              'path': 'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
              'sha256': 'f330d37988a3f7e508f696c245aa0917478fc3649451c0dc9bbef6cbf49f3655',
            },
            {
              'path': 'apps/www/src/content/docs/zh-cn/ui-libraries/base/tooltip.mdx',
              'sha256': '7cfad0c25c1832cec957ad1b7b8eaed9bd4a6b0d0402c077c5f74a6d1b5f7bf3',
            },
            {
              'path':
                'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/tooltip.mdx',
              'sha256': 'da8449a4e358b058eabebffae625691131771d717bc8dd64575f47112ec1a3e9',
            },
            {
              'path': 'apps/www/test/contrast-popup-escape.test.ts',
              'sha256': 'd3662b552c5031a0fc5505e4467e1466986119578b07044413cafa479e54478d',
            },
          ],
          'sharedSuitePlan': {
            'path': 'scripts/test/runtime-test-plan.mjs',
            'originalSha256': 'bf0f5e4beb3050c3630dde5542b128d7ee4e9dec221c1828a7b97a6231e89655',
            'integratedSha256': 'd3c9803e333533fbc11bd0885577db20d5b0d99f65bcf37de5e80b86e0c37538',
            'retainedAdditionalSuite': 'apps/www/test/release-docs-reading.browser.test.ts',
          },
        },
        reason:
          'Base and Brutalist Tooltip each added the Vue 2 declaration in en and zh-cn: four new declared cells. This does not prove their Usage.',
        addedHost: 'vue2',
        addedCells: 4,
        pages: [
          'apps/www/src/content/docs/en/ui-libraries/base/tooltip.mdx',
          'apps/www/src/content/docs/zh-cn/ui-libraries/base/tooltip.mdx',
          'apps/www/src/content/docs/en/ui-libraries/brutalist/components/tooltip.mdx',
          'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/tooltip.mdx',
        ],
      },
    },
    children: Object.entries(CATEGORIES).flatMap(([category, action]) => {
      const selected = rows.filter((row) => row.usage.category === category);
      return selected.length
        ? [
            {
              id: `s3.www.usage.${category}`,
              originalConditions: ['1042.acceptance.1', '1042.acceptance.2', '1042.acceptance.3'],
              owner: 'Sprint 3 website / original documentation and family source owners',
              state: 'open',
              action,
              ...compactFamilies(selected, locales),
            },
          ]
        : [];
    }),
    deliveryPrerequisites: ['public-target', 'workspace-source-only', 'no-component-target'].map(
      (kind) => ({
        id: `s3.www.delivery.${kind}`,
        owner: 'Sprint 2 reproducible delivery owner; Sprint 3 installed-consumer acceptance owner',
        producerIssues: kind === 'public-target' ? [1458, 1154] : [1458],
        acceptanceIssues: [1042, 1175, 1673],
        state: 'open',
        action:
          kind === 'public-target'
            ? 'Bind the declared fixed version, actual public target and npm/pnpm/npx/dlx results in a clean consumer.'
            : kind === 'workspace-source-only'
              ? 'Use the supported pinned-source delivery from #1458; public add rejects these targets. Do not relabel the workspace registry as installed admission.'
              : 'Use and verify the actual exported package subpath and public Adapter. A missing component facade is not a missing package export, and no add command may be invented.',
        ...compactFamilies(
          rows.filter((row) => row.cli.kind === kind),
          locales
        ),
      })
    ),
    omittedHosts: {
      id: 's3.www.host-declarations',
      owner: 'Sprint 3 website with original runtime/Adapter owner #568',
      originalConditions: ['1042.acceptance.3', '1042.acceptance.5'],
      state: 'open',
      action:
        'Verify the existing real demo through the omitted host before exposing it publicly; preserve unsupported or failing outcomes.',
      rows: omitted.map((row) => ({
        row: row.id,
        missing: inventory.runtimes.filter(
          (host) => !row.document.previews.some((p) => p.runtimes.includes(host))
        ),
      })),
      ...compactFamilies(omitted, locales),
    },
    otherRequiredChildren: [
      {
        id: 's3.www.generated-consumers',
        originalConditions: ['1042.acceptance.3'],
        owner: 'Sprint 2 compiler/real-consumer owner',
        producerIssues: [732, 733, 1055, 1061, 1145],
        state: 'open',
        action:
          'Preserve source x target x actual consumer identity. Public Adapter source examples cannot stand in for compiled consumers; authoring can proceed independently of this producer acceptance.',
      },
      {
        id: 's3.www.button-runtime-navigation',
        originalConditions: ['1042.acceptance.4', '1042.acceptance.5', '1042.acceptance.6'],
        owner: 'Sprint 3 website with #420/#568 and original #1438/#1435 owners',
        state: 'open',
        action:
          'Complete supported Button compositions, runtime state/focus, cold/failure/no-JS, native previous/next links, keyboard, themes, 320/390/desktop and enlarged-text journeys on the combined candidate.',
      },
      {
        id: 's3.www.catalog-78',
        originalConditions: ['1141:Repair public docs 78 family catalog drift'],
        owner: 'Current 0.3 execution owner with original #1090 source keys',
        state: 'open',
        action:
          'Reconcile all original 78 family catalog/availability/route/nav rows and original receipts. This 170-family export inventory does not replace them.',
      },
      {
        id: 's3.www.dropdown-anatomy',
        originalConditions: ['1141:Repair Dropdown anatomy replay model'],
        owner: 'Original Dropdown anatomy replay owner',
        state: 'open',
        action:
          'Retain the production retained-shell/readContrastAuditSubject 24-frame oracle, probe-only negative control, owner/generation/physical portal/currentLease, extras==0 and independent paint assertions.',
      },
      {
        id: 's3.www.mobile-m4-m5',
        originalConditions: [
          '1175:M4/M5 mobile journeys and forced boundaries',
          '1042.acceptance.6',
        ],
        owner: 'Sprint 3 website/acceptance coordinator with real device and AT operators',
        state: 'open',
        action:
          'Reconcile every original matrix row, forced-colors and boundary. Chromium CSS viewports/text scaling and AX queries do not replace physical mobile, real zoom or OS AT.',
      },
      {
        id: 's3.www.historical-source',
        originalConditions: ['1042.acceptance.1', '1175:original R5 execution/source'],
        owner: 'Original evidence/archive owners with Sprint 3 history coordinator',
        state: 'blocked-on-original-material',
        action:
          'Recover the original #1042 518-row/5784-cell matrix and #1175 fixed Camoufox driver/archive. Keep R5 76 phases=0 pass/76 fail and 155 subjects=5 pass/145 fail/5 unknown; current runs cannot rewrite them.',
      },
      {
        id: 's3.www.independent-acceptance',
        originalConditions: [
          '1042.acceptance.7',
          '1141:CI/DCO/native evidence',
          '1175:CI/DCO/independent review',
        ],
        owner: 'Sprint 3 integration owner and eligible independent reviewers',
        state: 'open',
        action:
          'Bind implementation, full selected native/installed results, screenshots, DCO and actual review to the final candidate. The 24 reading cells and 364 bounded dispatch cases do not close this ledger.',
      },
    ],
    producerReuse: {
      path: 'apps/www/scripts/example_code_generation/cli.ts',
      authored:
        'Existing --folder plus authored-code.ts verifies every demo ID and all four hosts; complete public source must be authored first.',
      legacy:
        'Static DemoSpec emission covers WC/React/Vue only; setup/ref callbacks and Vue 2 are not translated. Its folder scan excludes the top-level Finf .demo.ts wrappers. Do not generate inert lookalikes to satisfy Usage.',
      files: modules.map(({ file, entries, containsWebsiteAlias }) => ({
        file,
        demoIds: [...new Set(entries.map((entry) => entry.demoId))].sort(),
        hosts: [...new Set(entries.map((entry) => entry.host))].sort(),
        containsWebsiteAlias,
      })),
    },
  };
  for (const input of sourceInputs)
    if (hash(await readFile(path.join(root, input.path))) !== input.sha256)
      throw new Error(`Source changed during diagnosis: ${input.path}`);
  return { record, details: { inventory, inputs: sourceInputs, rows } };
}

export function readinessProblems(stored, actual) {
  const comparable = ({ observedCheckout, ...value }) => value;
  const problems = [];
  if (stored?.source?.inputDigest !== actual.source.inputDigest)
    problems.push('Source input bytes changed; regenerate and review the affected dispositions.');
  if (!stored || JSON.stringify(comparable(stored)) !== JSON.stringify(comparable(actual)))
    problems.push(
      'The complete source-bound child/owner ledger does not match the current diagnosis.'
    );
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      write: { type: 'boolean' },
      check: { type: 'boolean' },
      details: { type: 'string' },
    },
  });
  if (values.write && values.check) throw new Error('Choose --write or --check, not both.');
  const { record, details } = await buildWebsiteReadiness();
  if (values.write)
    await writeFile(path.join(ROOT, RECORD), `${JSON.stringify(record, null, 2)}\n`);
  if (values.details)
    await writeFile(path.resolve(values.details), `${JSON.stringify(details, null, 2)}\n`);
  const problems = values.check
    ? readinessProblems(JSON.parse(await readFile(path.join(ROOT, RECORD), 'utf8')), record)
    : [];
  console.log(
    JSON.stringify(
      { ...record.summary, diagnosisProblems: problems, productAcceptance: 'not-established' },
      null,
      2
    )
  );
  if (problems.length) process.exitCode = 1;
}
