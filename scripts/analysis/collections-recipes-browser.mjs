/**
 * Native browser acceptance of the actual Sprint 2 public collection recipes.
 * Prerequisite: corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style
 * Run: node --import tsx scripts/analysis/collections-recipes-browser.mjs
 * CHROME_PATH / PUI_CHROME_EXECUTABLE selects Chrome; PUI_EVIDENCE_DIR selects output.
 * PUI_BROWSER_FAMILIES/RUNTIMES/KINDS optionally bound a diagnostic run.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { renderBrutalistThemeCss } from '../../packages/prototypes/brutalist/src/theme.ts';
import { readCollectionsSourceInventory } from './collections-source-inventory.mjs';
import { readCollectionsRecipeCss } from './collections-recipe-css.mjs';
import { assertNativeRecipeInputs, partitionRecipeInputs } from './recipe-input-verification.mjs';

const select = (key, defaults) => process.env[key]?.split(',').filter(Boolean) ?? defaults;
const families = select('PUI_BROWSER_FAMILIES', ['base', 'shadcn', 'brutalist']);
const runtimes = select('PUI_BROWSER_RUNTIMES', ['wc', 'react', 'vue', 'vue2']);
const kinds = select('PUI_BROWSER_KINDS', ['tree', 'data-table', 'virtual-list']);
const output = path.resolve(process.env.PUI_EVIDENCE_DIR ?? '.tmp/collections-recipes-browser');
await mkdir(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const inventory = await readCollectionsSourceInventory();
const report = {
  kind: 'collections-public-recipes-native-chromium',
  capturedAt: new Date().toISOString(),
  source: {
    head: git('rev-parse', 'HEAD'),
    treeFilesSha256: inventory.sha256,
    treeFilesCount: inventory.paths.length,
    dirty: Boolean(git('status', '--porcelain')),
  },
  environment: {
    node: process.version,
    platform: process.platform,
    families,
    runtimes,
    kinds,
    viewport: { width: 1100, height: 850 },
  },
  boundary:
    'Actual public DemoSpecs, real Web Adapters/frameworks, generated prototype CSS and the ordinary Tailwind consumer stylesheet/fonts. Native Chromium keyboard, pointer, input and wheel. Runtime assets are bundled locally; import retry, physical hardware, screen readers, non-Web and compiler parity are separate acceptance.',
  cases: [],
};
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/collections-recipes-browser.ts'],
  bundle: true,
  write: false,
  outfile: path.join(output, 'consumer.js'),
  format: 'iife',
  globalName: 'PuiCollections',
  platform: 'browser',
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'bundled-runtime-urls',
      setup(build) {
        // Normal imports are the site's real local runtime modules, bundled by
        // esbuild. This isolated consumer does not serve/retest Astro retry URLs.
        build.onResolve({ filter: /^virtual:proto-ui\/runtime-retry-urls$/ }, () => ({
          path: 'retry-urls',
          namespace: 'fixture-runtime',
        }));
        build.onLoad({ filter: /.*/, namespace: 'fixture-runtime' }, () => ({
          contents: 'export default {};',
          loader: 'js',
        }));
      },
    },
  ],
});
const script = bundle.outputFiles.find((file) => file.path.endsWith('.js')).text;
const fixtureStyles = bundle.outputFiles
  .filter((file) => file.path.endsWith('.css'))
  .map((file) => file.text)
  .join('\n');
report.source.bundleSha256 = createHash('sha256').update(script).digest('hex');
const consumerStyles = await readCollectionsRecipeCss();
report.source.consumerStyles = consumerStyles.receipt;
const [theme, tokens] = await Promise.all([
  readFile('apps/www/src/styles/shadcn-theme.css', 'utf8'),
  readFile('apps/www/src/styles/proto-ui-tokens.generated.css', 'utf8'),
]);
const familyTheme = renderBrutalistThemeCss({
  variablePrefix: 'pui-',
  lightSelector: ':root[data-family="brutalist"]',
  darkSelector: ':root[data-family="brutalist"][data-theme="dark"]',
  includeSelection: false,
});
report.source.styles = Object.fromEntries(
  Object.entries({ theme, tokens, familyTheme, fixtureStyles }).map(([key, value]) => [
    key,
    createHash('sha256').update(value).digest('hex'),
  ])
);
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
let executablePath;
for (const candidate of [
  process.env.CHROME_PATH,
  process.env.PUI_CHROME_EXECUTABLE,
  chromium.executablePath(),
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean)) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {
    /* next installed browser */
  }
}
if (!executablePath) throw new Error('Chrome/Chromium is required; set CHROME_PATH.');
const browser = await chromium.launch({
  executablePath,
  headless: true,
  chromiumSandbox: true,
  args: ['--disable-dev-shm-usage'],
});
report.environment.browser = browser.version();
const page = await browser.newPage({ viewport: report.environment.viewport, colorScheme: 'light' });
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.setContent(
  '<!doctype html><html data-theme="light"><head><meta charset="utf-8"></head><body><main><h1>Proto UI · collection recipes</h1><p id="scope"></p><div id="fixture"></div></main></body></html>'
);
await page.addStyleTag({
  content: `@layer reset, theme, base, proto-ui, components, utilities, consumer;
  @layer reset { *,::before,::after { box-sizing:border-box; } body { margin:0; font:16px/1.5 system-ui,sans-serif; color:#172033; background:#f5f7fb; } }
  @layer theme { ${theme}\n${familyTheme} }
  ${consumerStyles.css}
  ${tokens}
  ${fixtureStyles}
  @layer consumer { main { padding:40px; } #fixture { width:760px; max-width:100%; min-height:360px; padding:20px; background:white; border:1px solid #dce2eb; } h1 { font-size:24px; } }
`,
});
await page.addScriptTag({ content: script });
const ref = (name) => page.locator(`[data-demo-ref="${name}"]`);
const settle = () => page.evaluate(() => PuiCollections.settle());
const read = (ref, path, ...args) =>
  page.evaluate(([ref, path, args]) => PuiCollections.read(ref, path, ...args), [ref, path, args]);
const props = async (ref, value) => {
  await page.evaluate(([ref, value]) => PuiCollections.setProps(ref, value), [ref, value]);
  await settle();
};
const until = (ref, path, expected) =>
  page.waitForFunction(
    ([ref, path, expected]) =>
      JSON.stringify(PuiCollections.read(ref, path)) === JSON.stringify(expected),
    [ref, path, expected]
  );
const visible = (name) =>
  ref(name).evaluate(
    (node) =>
      getComputedStyle(node).display !== 'none' &&
      node.getBoundingClientRect().width > 0 &&
      node.getBoundingClientRect().height > 0
  );
const capture = async (name) => {
  const file = `${name}.png`;
  await page.locator('main').screenshot({ path: path.join(output, file) });
  return file;
};

async function tree(prefix) {
  assert.equal(await read('tree', 'invalid.get'), false);
  assert.equal(
    await ref('project').getAttribute('aria-controls'),
    await ref('branch').getAttribute('id')
  );
  assert.equal(
    await ref('branch').getAttribute('aria-labelledby'),
    await ref('project').getAttribute('id')
  );
  await props('tree', { direction: 'rtl' });
  assert.equal(await ref('tree').evaluate((node) => getComputedStyle(node).direction), 'rtl');
  await ref('project').click();
  await until('tree', 'value.get', 'project');
  await page.keyboard.press('ArrowRight');
  await until('tree', 'getExpandedKeys', []);
  assert.equal(await visible('branch'), false);
  // A disabled non-native target may remove tabindex; the guaranteed facts
  // are absence from sequential navigation and rejection of actual focus.
  assert.equal(await ref('readme').evaluate((node) => node.tabIndex), -1);
  await ref('readme').evaluate((node) => node.focus());
  assert.equal(await ref('project').evaluate((node) => document.activeElement === node), true);
  await read('readme', 'focusSelf');
  assert.equal(await ref('project').evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Tab');
  assert.equal(await ref('toggle').evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Tab');
  assert.equal(
    await ref('branch').evaluate((node) => node.contains(document.activeElement)),
    false,
    'native Tab crosses the collapsed branch without entering a hidden descendant'
  );
  await ref('project').focus();
  await page.keyboard.press('ArrowLeft');
  await until('tree', 'getExpandedKeys', ['project']);
  assert.equal(await visible('branch'), true);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await ref('readme').evaluate((node) => document.activeElement === node), true);
  // App-owned committed collapse while a descendant owns physical focus.
  await props('tree', { expandedKeys: [] });
  assert.equal(await ref('project').evaluate((node) => document.activeElement === node), true);
  await props('tree', { expandedKeys: ['project'] });
  await page.keyboard.press('ArrowRight');
  await settle();
  assert.deepEqual(await read('tree', 'getExpandedKeys'), ['project']);
  assert.equal(await visible('branch'), true);
  assert.equal(await read('tree', 'value.get'), 'project');
  return {
    checks: [
      'scoped Item/Group relationships',
      'native RTL keyboard',
      'actual hidden Group geometry',
      'ancestor focus repair',
      'controlled expansion refusal',
      'selection independent of navigation',
    ],
    pictures: [await capture(`${prefix}-rtl`)],
  };
}
async function dataTable(prefix) {
  await ref('select-page').click();
  await until('table', 'getSelectedKeys', ['api', 'web']);
  await ref('next').click();
  await until('table', 'pageSelection.get', 'none');
  await ref('select-page').click();
  await until('table', 'getSelectedKeys', ['api', 'web', 'docs']);
  const input = ref('name-filter')
    .locator('input')
    .or(ref('name-filter').and(page.locator('input')));
  await input.fill('Web');
  await until('table', 'filteredCount.get', 1);
  assert.equal(await ref('row-0').textContent(), 'Website[BUSY]');
  assert.equal(await ref('row-1').getAttribute('aria-hidden'), 'true');
  assert.equal(await visible('row-1'), false);
  const structure = await read('table', 'getStructure');
  assert.equal(structure.valid, true);
  assert.equal(structure.columnCount, 2);
  await ref('toggle-status').click();
  await settle();
  assert.equal(await visible('state-0'), false);
  assert.equal(await visible('state-header'), false);
  assert.equal(await ref('state-header').evaluate((node) => node.tabIndex), -1);
  await ref('state-header').evaluate((node) => node.focus());
  assert.equal(
    await ref('toggle-status').evaluate((node) => document.activeElement === node),
    true
  );
  await ref('name-header').focus();
  await page.keyboard.press('Tab');
  assert.equal(await ref('row-0').evaluate((node) => document.activeElement === node), true);
  assert.equal((await read('table', 'getStructure')).valid, true);
  const hidden = await capture(`${prefix}-column-hidden`);
  await ref('toggle-status').click();
  await settle();
  assert.equal(await visible('state-0'), true);
  await ref('state-header').focus();
  assert.equal(await ref('state-header').evaluate((node) => document.activeElement === node), true);
  await props('table', { rows: [{ id: 'web', name: 'Website', state: 'updated' }] });
  assert.equal(await ref('row-0').textContent(), 'Website[UPDATED]');
  await ref('name-header').focus();
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press('Space');
  await until('name-header', 'sort.get', 'ascending');
  assert.equal(await page.evaluate(() => scrollY), scroll);
  await props('table', { selectedKeys: [], readOnly: true });
  await ref('select-page').click();
  await settle();
  assert.deepEqual(await read('table', 'getSelectedKeys'), []);
  return {
    checks: [
      'native Input column filter',
      'page selection preserves other pages',
      'hidden column physical geometry',
      'valid table after empty rows',
      'custom cell same-ID update',
      'native Space sort once without scrolling',
      'readOnly selection refusal',
    ],
    pictures: [hidden, await capture(`${prefix}-restored`)],
  };
}
async function virtualList(prefix) {
  const viewport = ref('viewport');
  const initialViewport = await viewport.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    scrollTop: node.scrollTop,
    overflowY: getComputedStyle(node).overflowY,
  }));
  assert.ok(initialViewport.clientHeight > 0);
  assert.ok(initialViewport.scrollHeight > initialViewport.clientHeight);
  assert.match(initialViewport.overflowY, /^(auto|scroll)$/);
  const initial = await read('list', 'getWindow');
  assert.equal(initial.keys.length, 1000);
  assert.equal(initial.status, 'committed');
  assert.ok(initial.materializedKeys.length > 0 && initial.materializedKeys.length <= 60);
  await viewport.hover();
  await page.mouse.wheel(0, 600);
  await page.waitForFunction(
    (keys) =>
      JSON.stringify(PuiCollections.read('list', 'getWindow').materializedKeys) !==
      JSON.stringify(keys),
    initial.materializedKeys
  );
  const after = await read('list', 'getWindow');
  const afterScrollTop = await viewport.evaluate((node) => node.scrollTop);
  assert.ok(
    afterScrollTop > initialViewport.scrollTop,
    'native wheel actually scrolls the viewport'
  );
  assert.ok(after.materializedKeys.length <= 60);
  assert.equal(after.keys.length, 1000);
  assert.equal(
    await ref('content').locator('[role="listitem"]').count(),
    after.materializedKeys.length
  );
  const picture = await capture(`${prefix}-scrolled`);
  const cleanup = await page.evaluate(() => PuiCollections.dispose());
  assert.deepEqual(cleanup, { hostChildren: 0, ownedContentChildren: 0 });
  return {
    checks: [
      'complete logical key sequence',
      'bounded materialization',
      'native wheel changes window',
      'actual Root cleanup removes views',
    ],
    initial: initial.materializedKeys,
    after: after.materializedKeys,
    initialViewport,
    afterScrollTop,
    pictures: [picture],
  };
}
try {
  for (const family of families)
    for (const runtime of runtimes)
      for (const kind of kinds) {
        const prefix = `${family}-${runtime}-${kind}`,
          errorStart = errors.length;
        const result = { family, runtime, kind, status: 'failed' };
        try {
          await page.evaluate(
            ([runtime, family, kind]) => {
              document.documentElement.dataset.family = family;
              document.querySelector('#scope').textContent = `${family} / ${runtime} / ${kind}`;
              return PuiCollections.mount(runtime, family, kind);
            },
            [runtime, family, kind]
          );
          Object.assign(
            result,
            await { tree, 'data-table': dataTable, 'virtual-list': virtualList }[kind](prefix)
          );
          result.inputs = await page.evaluate(() => PuiCollections.inputs());
          Object.assign(result, partitionRecipeInputs(result.inputs));
          assertNativeRecipeInputs(result.inputs);
          assert.deepEqual(errors.slice(errorStart), []);
          result.status = 'passed';
        } catch (error) {
          result.error = String(error.stack ?? error);
          try {
            result.failurePicture = await capture(`${prefix}-failure`);
          } catch (captureError) {
            result.captureError = String(captureError);
          }
        } finally {
          result.pageErrors = errors.slice(errorStart);
          try {
            result.inputs = await page.evaluate(() => PuiCollections.inputs());
            Object.assign(result, partitionRecipeInputs(result.inputs));
            assert.deepEqual(await page.evaluate(() => PuiCollections.dispose()), {
              hostChildren: 0,
              ownedContentChildren: 0,
            });
          } catch (error) {
            result.status = 'failed';
            result.cleanupError = String(error);
          }
          report.cases.push(result);
          await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
          console.log(`${result.status}: ${prefix}`);
        }
      }
} finally {
  await browser.close();
}
report.passed = report.cases.filter((result) => result.status === 'passed').length;
report.failed = report.cases.length - report.passed;
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  `Collections public recipes: ${report.passed}/${report.cases.length}; ${path.join(output, 'report.json')}`
);
if (report.failed) process.exitCode = 1;
