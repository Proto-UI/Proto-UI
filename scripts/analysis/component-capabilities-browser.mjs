/**
 * Real Chromium acceptance for the four missing component capability slices.
 * Run after `pnpm --filter apps-www generate:proto-ui-style`:
 *   node --import tsx scripts/analysis/component-capabilities-browser.mjs
 * PUI_CHROME_EXECUTABLE selects the browser; PUI_EVIDENCE_DIR selects disposable output.
 * Optional comma-separated PUI_BROWSER_RUNTIMES/FAMILIES/KINDS bound a diagnostic run.
 * Native mouse/keyboard/wheel input is driven through Playwright. No geometry,
 * scroll offsets, component state, or expected results are injected into the host.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';

const select = (key, defaults) => process.env[key]?.split(',').filter(Boolean) ?? defaults;
const runtimes = select('PUI_BROWSER_RUNTIMES', ['wc', 'react', 'vue', 'vue2']);
const families = select('PUI_BROWSER_FAMILIES', [
  'base',
  'shadcn',
  'brutalist',
  'bootstrap-2-3-2',
  'liquid-glass',
]);
const kinds = select('PUI_BROWSER_KINDS', [
  'resizable',
  'carousel',
  'number-field',
  'calendar',
  'date-picker',
]);
const output = path.resolve(process.env.PUI_EVIDENCE_DIR ?? '.tmp/component-capabilities-browser');
await mkdir(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourcePaths = [
  ...new Set([
    ...git('ls-files', 'packages', 'apps/www/src/content/docs', 'scripts/analysis').split('\n'),
    ...git(
      'ls-files',
      '--others',
      '--exclude-standard',
      'packages',
      'apps/www/src/content/docs',
      'scripts/analysis'
    ).split('\n'),
  ]),
]
  .filter(Boolean)
  .sort();
const sourceDigest = createHash('sha256');
for (const file of sourcePaths) {
  sourceDigest.update(file + '\0');
  sourceDigest.update(await readFile(file));
}
const report = {
  kind: 'component-capabilities-native-chromium',
  capturedAt: new Date().toISOString(),
  source: {
    head: git('rev-parse', 'HEAD'),
    branch: git('branch', '--show-current'),
    treeFilesSha256: sourceDigest.digest('hex'),
  },
  environment: {
    node: process.version,
    platform: process.platform,
    viewport: { width: 1100, height: 850 },
    theme: 'light',
    runtimes,
    families,
    kinds,
  },
  boundary:
    'Actual public prototypes and Web adapters with generated production CSS; native Chromium mouse, keyboard and wheel. Physical IME, touch hardware, screen-reader and non-Web hosts are not claimed.',
  cases: [],
};
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/component-capabilities-browser.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'PuiCapabilities',
  platform: 'browser',
  tsconfig: 'tsconfig.json',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const [theme, tokens] = await Promise.all([
  readFile('apps/www/src/styles/shadcn-theme.css', 'utf8'),
  readFile('apps/www/src/styles/proto-ui-tokens.generated.css', 'utf8'),
]);
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PUI_CHROME_EXECUTABLE ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
report.environment.browser = browser.version();
const page = await browser.newPage({ viewport: report.environment.viewport });
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.setContent(
  '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="evidence"><h1>Proto UI · component capabilities</h1><p id="scope"></p><div id="fixture"></div></main></body></html>'
);
await page.addStyleTag({
  content: `
  @layer reset, theme, proto-ui, consumer;
  @layer reset { *,::before,::after { box-sizing: border-box; } body { margin:0; font:16px/1.5 system-ui,sans-serif; color:#172033; background:#f5f7fb; } }
  @layer theme { ${theme} }
  ${tokens}
  @layer consumer { #evidence { width:100%; padding:40px; } h1 { margin:0 0 8px; font-size:24px; } #scope { margin:0 0 28px; color:#4b5563; } #fixture { width:760px; max-width:100%; min-height:360px; padding:20px; background:white; border:1px solid #dce2eb; border-radius:12px; } }
`,
});
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const settle = () =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
const read = (id, key) =>
  page.evaluate(({ id, key }) => PuiCapabilities.read(id, key), { id, key });
const update = (id, patch) =>
  page.evaluate(({ id, patch }) => PuiCapabilities.update(id, patch), { id, patch });
const allEvents = () => page.evaluate(() => PuiCapabilities.events());
const rect = (id) => page.locator(`.cap-${id}`).first().boundingBox();
const near = (actual, expected, tolerance = 0.5, why = '') =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${why}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
const vector = (actual, expected, why = '') => {
  assert.equal(actual.length, expected.length, why);
  actual.forEach((n, i) => near(n, expected[i], 0.45, `${why}[${i}]`));
};
const until = (id, key, expected) =>
  page.waitForFunction(
    ({ id, key, expected }) =>
      JSON.stringify(PuiCapabilities.read(id, key)) === JSON.stringify(expected),
    { id, key, expected }
  );
const mount = async (runtime, family, kind, options = {}) => {
  await page.evaluate(
    ({ runtime, family, kind, options }) => PuiCapabilities.mount(runtime, family, kind, options),
    { runtime, family, kind, options }
  );
  await page.locator('#scope').evaluate((el, value) => {
    el.textContent = value;
  }, `${family} / ${runtime} / ${kind} — native Chromium, light theme`);
  await settle();
};
const capture = async (name) => {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: true });
  return file;
};
const drag = async (id, dx, dy = 0, middle) => {
  const box = await rect(id);
  assert.ok(box && box.width > 0 && box.height > 0, `${id} has a native hit target`);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx * 0.5, y + dy * 0.5, { steps: 4 });
  await settle();
  if (middle) await middle();
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
  await settle();
};

async function resizable(runtime, family, prefix) {
  await mount(runtime, family, 'resizable');
  vector(await read('root', 'sizes'), [25, 35, 40], 'initial complete group');
  const boxes = await Promise.all(['panel0', 'panel1', 'panel2'].map(rect));
  const extent = boxes.reduce((sum, b) => sum + b.width, 0);
  const startHandle = await rect('handle1');
  const pictures = [await capture(`${prefix}-before`)];
  let during;
  await drag('handle1', extent * 0.1, 0, async () => {
    during = await read('root', 'sizes');
    vector(during, [25, 40, 35], 'continuous drag before release');
    assert.equal(
      (await allEvents()).filter((e) => e.id === 'root' && e.type === 'sizesCommit').length,
      0
    );
    pictures.push(await capture(`${prefix}-dragging`));
  });
  const after = await read('root', 'sizes');
  vector(after, [25, 45, 30], 'committed adjacent pair');
  const endHandle = await rect('handle1');
  near(
    endHandle.x - startHandle.x,
    extent * 0.1,
    1.5,
    'handle follows native pointer displacement'
  );
  const innerBoxes = await Promise.all(['inner-panel0', 'inner-panel1'].map(rect));
  const innerExtent = innerBoxes.reduce((sum, b) => sum + b.height, 0);
  await drag('inner-handle0', 0, innerExtent * 0.1);
  vector(await read('inner', 'sizes'), [50, 50], 'nested vertical drag');
  vector(await read('root', 'sizes'), after, 'nested owner isolation');
  pictures.push(await capture(`${prefix}-after`));
  await mount(runtime, family, 'resizable', { sizes: [25, 35, 40] });
  const controlledStart = await rect('handle1');
  await drag('handle1', extent * 0.1);
  vector(await read('root', 'sizes'), [25, 35, 40], 'controlled refusal');
  near(
    (await rect('handle1')).x,
    controlledStart.x,
    0.5,
    'refused layout remains painted at owner value'
  );
  assert.ok((await allEvents()).some((e) => e.id === 'root' && e.type === 'sizesChange'));
  await mount(runtime, family, 'resizable', {
    constraints: [{ min: 20, collapsible: true }, { min: 15 }, {}],
  });
  await page.locator('.cap-handle0').press('Enter');
  near((await read('root', 'sizes'))[0], 0, 0.001, 'keyboard collapse uses the constrained route');
  near((await rect('panel0')).width, 0, 0.5, 'collapsed family panel has no padding floor');
  await page.locator('#fixture').evaluate((el) => {
    el.dir = 'rtl';
  });
  await mount(runtime, family, 'resizable', { direction: 'rtl' });
  assert.ok(
    (await rect('panel0')).x > (await rect('panel2')).x,
    'RTL panel order under an RTL ancestor'
  );
  const rtlExtent = (await Promise.all(['panel0', 'panel1', 'panel2'].map(rect))).reduce(
    (sum, b) => sum + b.width,
    0
  );
  await drag('handle1', -rtlExtent * 0.1);
  vector(await read('root', 'sizes'), [25, 45, 30], 'RTL logical drag');
  await mount(runtime, family, 'resizable', { direction: 'ltr' });
  assert.ok(
    (await rect('panel0')).x < (await rect('panel2')).x,
    'explicit LTR overrides inherited RTL'
  );
  await page.locator('#fixture').evaluate((el) => {
    el.removeAttribute('dir');
  });
  return {
    extent,
    during,
    after,
    innerExtent,
    pictures,
    checks: [
      'continuous adjacent drag',
      'exact separator displacement',
      'nested vertical isolation',
      'controlled refusal',
      'native keyboard collapse',
      'zero physical collapsed width',
      'inherited RTL isolation',
    ],
  };
}

async function carousel(runtime, family, prefix) {
  await mount(runtime, family, 'carousel');
  await until('root', 'slideCount', 6);
  near(await read('root', 'visibleSlides'), 2, 0.08, 'wide multiple-item viewport');
  const viewport = await rect('viewport');
  let during;
  await drag('viewport', -viewport.width * 0.4, 0, async () => {
    during = await read('viewport', 'scrollPosition');
    assert.ok(during > 0.025, 'native content already moves before release');
    assert.equal(await read('root', 'index'), 0, 'snap owner is not committed mid-contact');
    assert.equal(await read('viewport', 'dragging'), true);
    assert.equal(await read('slide2', 'hidden'), false, 'entering slide is painted during drag');
  });
  await until('root', 'index', 1);
  near(await read('viewport', 'scrollPosition'), 0.25, 0.02, 'release snaps to accepted index');
  const pictures = [await capture(`${prefix}-snapped`)];
  // Change the consumer's available space; the component reads actual host extent.
  await page.locator('#fixture').evaluate((el) => {
    el.style.width = '320px';
  });
  await page.waitForFunction(() => PuiCapabilities.read('root', 'visibleSlides') < 1.9);
  const narrowVisible = await read('root', 'visibleSlides');
  assert.ok(
    narrowVisible >= 1 && narrowVisible < 1.9,
    'minimum item width changes actual capacity'
  );
  pictures.push(await capture(`${prefix}-narrow`));
  await page.locator('#fixture').evaluate((el) => {
    el.style.width = '';
  });
  await mount(runtime, family, 'carousel', { index: 0 });
  await drag('viewport', -viewport.width * 0.4);
  await until('viewport', 'dragging', false);
  near(
    await read('viewport', 'scrollPosition'),
    0,
    0.005,
    'controlled refusal rolls back native scroll'
  );
  assert.equal(await read('root', 'index'), 0);
  assert.ok((await allEvents()).some((e) => e.type === 'indexChange' && e.detail.index === 1));
  await mount(runtime, family, 'carousel');
  const wheelBox = await rect('viewport');
  await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);
  await page.mouse.wheel(wheelBox.width * 0.4, 0);
  await until('root', 'index', 1);
  near(await read('viewport', 'scrollPosition'), 0.25, 0.025, 'native wheel rests on a snap');
  await mount(runtime, family, 'carousel', { direction: 'rtl' });
  await drag('viewport', viewport.width * 0.4);
  await until('root', 'index', 1);
  near(await read('viewport', 'scrollPosition'), 0.25, 0.025, 'native RTL logical scroll and snap');
  await mount(runtime, family, 'carousel', { orientation: 'vertical' });
  const verticalBox = await rect('viewport');
  await drag('viewport', 0, -verticalBox.height * 0.45);
  await until('root', 'index', 1);
  near(
    await read('viewport', 'scrollPosition'),
    1 / (6 - (await read('root', 'visibleSlides'))),
    0.025,
    'native vertical snap'
  );
  return {
    during,
    narrowVisible,
    pictures,
    checks: [
      'native continuous drag',
      'entering item paint',
      'release snap',
      'responsive capacity',
      'controlled rollback',
      'native wheel snap',
      'native RTL snap',
      'native vertical snap',
    ],
  };
}

async function numberField(runtime, family, prefix) {
  await mount(runtime, family, 'number-field');
  const input = page.locator('#fixture input').first();
  assert.equal(await input.inputValue(), '20,5');
  const labelBox = await rect('label');
  let during;
  await drag('label', labelBox.width * 0.25, 0, async () => {
    during = await read('root', 'getValue');
    assert.ok(during > 20.5 && during < 23.1, 'scrub updates before release');
    assert.equal(await read('root', 'dragging'), true);
  });
  near(await read('root', 'getValue'), 23, 0.001, 'scrub step semantics');
  const pictures = [await capture(`${prefix}-scrubbed`)];
  await input.fill('1.234,5');
  await input.press('Enter');
  near(await read('root', 'getValue'), 1234.5, 0.001, 'localized grouping and decimal parse');
  await input.fill('');
  await input.press('Enter');
  assert.equal(await read('root', 'getValue'), null, 'empty canonical value');
  assert.equal(await read('root', 'empty'), true);
  assert.ok((await allEvents()).some((e) => e.type === 'valueChange' && e.detail.value === null));
  pictures.push(await capture(`${prefix}-empty`));
  await mount(runtime, family, 'number-field', { value: 20.5 });
  await drag('label', labelBox.width * 0.25);
  assert.equal(await read('root', 'getValue'), 20.5, 'controlled scrub refusal');
  assert.equal(await page.locator('#fixture input').first().inputValue(), '20,5');
  // Policy changes while native pointer contact is live must cancel the session.
  await mount(runtime, family, 'number-field');
  const cancelLabel = await rect('label');
  await page.mouse.move(
    cancelLabel.x + cancelLabel.width / 2,
    cancelLabel.y + cancelLabel.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    cancelLabel.x + cancelLabel.width * 0.75,
    cancelLabel.y + cancelLabel.height / 2,
    { steps: 4 }
  );
  await update('root', { scrub: false });
  await page.mouse.up();
  await settle();
  assert.equal(await read('root', 'getValue'), 20.5, 'policy cancellation restores scrub baseline');
  assert.equal(await read('root', 'dragging'), false);
  await mount(runtime, family, 'number-field', { direction: 'rtl' });
  await drag('label', -labelBox.width * 0.25);
  near(
    await read('root', 'getValue'),
    23,
    0.001,
    'RTL label drag increases in the logical direction'
  );
  return {
    during,
    pictures,
    checks: [
      'localized native input',
      'continuous label drag',
      'nullable input and events',
      'controlled refusal',
      'live contact cancellation',
      'native RTL label drag',
    ],
  };
}

async function calendar(runtime, family, prefix) {
  await mount(runtime, family, 'calendar', { mode: 'range' });
  await page.locator('.cap-date-2026-10-10').click();
  assert.deepEqual(await read('root', 'getRange'), { from: '2026-10-10' });
  await page.locator('.cap-date-2026-10-14').click();
  assert.deepEqual(await read('root', 'getRange'), { from: '2026-10-10', to: '2026-10-14' });
  assert.equal(await read('date-2026-10-10', 'rangeStart'), true);
  assert.equal(await read('date-2026-10-12', 'rangeMiddle'), true);
  assert.equal(await read('date-2026-10-14', 'rangeEnd'), true);
  assert.equal(await page.locator('.cap-date-2026-10-12').getAttribute('aria-selected'), 'true');
  const pictures = [await capture(`${prefix}-range`)];
  await mount(runtime, family, 'calendar', { mode: 'multiple' });
  for (const day of ['03', '08', '12']) await page.locator(`.cap-date-2026-10-${day}`).click();
  assert.deepEqual(await read('root', 'getValues'), ['2026-10-03', '2026-10-08', '2026-10-12']);
  await page.locator('.cap-date-2026-10-08').click();
  assert.deepEqual(await read('root', 'getValues'), ['2026-10-03', '2026-10-12']);
  pictures.push(await capture(`${prefix}-multiple`));
  return {
    pictures,
    checks: [
      'native range selection',
      'endpoint and interior day paint',
      'inclusive aria selection',
      'multiple toggle',
    ],
  };
}

async function datePicker(runtime, family, prefix) {
  await mount(runtime, family, 'date-picker', { mode: 'range' });
  await page.locator('.cap-trigger').click();
  await until('root', 'open', true);
  await page.locator('.cap-date-2026-10-10').click();
  assert.equal(await read('root', 'open'), true, 'incomplete range keeps picker open');
  const pictures = [await capture(`${prefix}-pending`)];
  await page.locator('.cap-date-2026-10-14').click();
  await until('root', 'open', false);
  assert.deepEqual(await read('root', 'getRange'), { from: '2026-10-10', to: '2026-10-14' });
  pictures.push(await capture(`${prefix}-complete`));
  await mount(runtime, family, 'date-picker', { mode: 'range', range: { from: '2026-10-10' } });
  await page.locator('.cap-trigger').click();
  await page.locator('.cap-date-2026-10-14').click();
  assert.equal(await read('root', 'open'), true, 'refused controlled completion keeps popup open');
  assert.equal((await read('root', 'getRange')).to, undefined);
  return {
    pictures,
    checks: [
      'native popup and partial range',
      'accepted completion closes',
      'controlled refusal remains open',
    ],
  };
}

const handlers = {
  resizable,
  carousel,
  'number-field': numberField,
  calendar,
  'date-picker': datePicker,
};
try {
  for (const runtime of runtimes)
    for (const family of families)
      for (const kind of kinds) {
        const prefix = `${runtime}-${family}-${kind}`;
        const errorStart = errors.length;
        try {
          // A failed narrow/RTL assertion must not contaminate the next journey.
          await page.locator('#fixture').evaluate((el) => {
            el.style.width = '';
            el.removeAttribute('dir');
          });
          const result = await handlers[kind](runtime, family, prefix);
          await page.evaluate(() => PuiCapabilities.cleanup());
          await settle();
          assert.deepEqual(
            errors.slice(errorStart),
            [],
            'no uncaught browser errors during interaction or teardown'
          );
          report.cases.push({ runtime, family, kind, status: 'passed', ...result });
          console.log(`PASS ${prefix}`);
        } catch (error) {
          await page.mouse.up().catch(() => {});
          const screenshot = await capture(`${prefix}-failure`).catch(() => null);
          report.cases.push({
            runtime,
            family,
            kind,
            status: 'failed',
            error: error.stack ?? String(error),
            browserErrors: errors.slice(errorStart),
            screenshot,
          });
          console.error(`FAIL ${prefix}: ${error.message}`);
          await page.evaluate(() => PuiCapabilities.cleanup()).catch(() => {});
          if (process.env.PUI_BROWSER_FAIL_FAST === '1') throw error;
        }
        await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      }
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
const passed = report.cases.filter((c) => c.status === 'passed').length;
console.log(
  `${passed}/${report.cases.length} native component journeys passed; ${path.join(output, 'report.json')}`
);
if (passed !== report.cases.length) process.exitCode = 1;
