/**
 * Source-bound native Chromium consumers for Sprint 2 shared input.
 * First run: corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style
 * Then: node --import tsx scripts/analysis/sprint2-input-browser.mjs
 * PUI_CHROME_EXECUTABLE (or CHROME_PATH), PUI_EVIDENCE_DIR and the usual
 * PUI_BROWSER_FAMILIES / RUNTIMES / KINDS selectors are supported.
 * Each controlled and uncontrolled branch receives an independent terminal
 * receipt; failure never prevents the other owner branch from running.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { renderBrutalistThemeCss } from '../../packages/prototypes/brutalist/src/theme.ts';

const selected = (name, fallback) => process.env[name]?.split(',').filter(Boolean) ?? fallback;
const families = selected('PUI_BROWSER_FAMILIES', ['base', 'shadcn', 'brutalist']);
const runtimes = selected('PUI_BROWSER_RUNTIMES', ['wc', 'react', 'vue', 'vue2']);
const kinds = selected('PUI_BROWSER_KINDS', ['input-otp', 'slider-values']);
for (const kind of kinds) assert.ok(['input-otp', 'slider-values'].includes(kind), kind);
const output = path.resolve(process.env.PUI_EVIDENCE_DIR ?? '.tmp/sprint2-input-browser');
await mkdir(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const files = [
  ...new Set([
    ...git('ls-files', 'packages', 'scripts/analysis', 'spec/contracts', 'spec/prototypes').split(
      '\n'
    ),
    ...git(
      'ls-files',
      '--others',
      '--exclude-standard',
      'packages',
      'scripts/analysis',
      'spec/contracts',
      'spec/prototypes'
    ).split('\n'),
  ]),
]
  .filter(Boolean)
  .sort();
const digest = createHash('sha256');
for (const file of files) {
  digest.update(`${file}\0`);
  digest.update(await readFile(file));
}
const report = {
  kind: 'sprint2-public-input-native-chromium',
  capturedAt: new Date().toISOString(),
  source: {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    status: git('status', '--porcelain'),
    treeFilesSha256: digest.digest('hex'),
  },
  environment: {
    node: process.version,
    platform: process.platform,
    viewport: { width: 1100, height: 850 },
    families,
    runtimes,
    kinds,
  },
  boundary:
    'Real public prototypes and four Web Adapters with repository-generated production CSS. Browser-generated trusted mouse and keyboard input; no fake geometry or component values. Physical OS IME, touch hardware, screen readers, non-Web hosts and Compiler admission remain independent.',
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
const brutalistTheme = renderBrutalistThemeCss({
  variablePrefix: 'pui-',
  lightSelector: ':root[data-evidence-family="brutalist"]',
  darkSelector: ':root[data-evidence-family="brutalist"][data-theme="dark"]',
  includeSelection: false,
});
report.source.stylesSha256 = createHash('sha256')
  .update(theme)
  .update(tokens)
  .update(brutalistTheme)
  .digest('hex');
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ?? process.env.CHROME_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
report.environment.browser = browser.version();
const page = await browser.newPage({ viewport: report.environment.viewport, colorScheme: 'light' });
page.setDefaultTimeout(7000);
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
await page.setContent(
  '<!doctype html><html data-theme="light"><head><meta charset="utf-8"></head><body><main><h1>Proto UI · Sprint 2 input</h1><p id="scope"></p><div id="fixture"></div><button id="outside">Outside focus</button></main></body></html>'
);
await page.addStyleTag({
  content: `
  @layer reset, theme, proto-ui, consumer;
  @layer reset { *,::before,::after { box-sizing: border-box; } body { margin:0; font:16px/1.5 system-ui,sans-serif; color:#172033; background:#f5f7fb; } }
  @layer theme { ${theme}\n${brutalistTheme} }
  ${tokens}
  @layer consumer { main { padding:40px; } h1 { margin:0 0 8px; font-size:24px; } #scope { margin:0 0 28px; } #fixture { width:800px; max-width:100%; min-height:360px; padding:28px; background:white; border:1px solid #dce2eb; border-radius:12px; } #outside { margin-top:20px; } }
`,
});
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const settle = () => page.evaluate(() => PuiCapabilities.settle());
const read = (id, key) =>
  page.evaluate(({ id, key }) => PuiCapabilities.read(id, key), { id, key });
const call = (id, key, ...args) =>
  page.evaluate(({ id, key, args }) => PuiCapabilities.call(id, key, ...args), { id, key, args });
const update = (id, patch) =>
  page.evaluate(({ id, patch }) => PuiCapabilities.update(id, patch), { id, patch });
const events = () => page.evaluate(() => PuiCapabilities.events());
const eventCount = async (type, id = 'root') =>
  (await events()).filter((event) => event.id === id && event.type === type).length;
const box = async (id) => {
  const result = await page.locator(`.cap-${id}`).first().boundingBox();
  assert.ok(result && result.width > 0 && result.height > 0, `${id} must have actual layout`);
  return result;
};
const mount = async (runtime, family, kind, props = {}) => {
  await page.evaluate(
    ({ runtime, family, kind, props }) => PuiCapabilities.mount(runtime, family, kind, props),
    { runtime, family, kind, props }
  );
  await page.evaluate(() => {
    window.__inputAbort?.abort();
    window.__inputAbort = new AbortController();
    window.__inputFacts = [];
    for (const name of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'keydown',
      'beforeinput',
      'input',
      'select',
      'selectionchange',
    ]) {
      document.addEventListener(
        name,
        (event) => {
          if (!document.getElementById('fixture')?.contains(event.target)) return;
          window.__inputFacts.push({
            type: event.type,
            trusted: event.isTrusted,
            pointerType: event.pointerType ?? null,
            buttons: event.buttons ?? null,
            key: event.key ?? null,
          });
        },
        { capture: true, signal: (window.__inputAbort ??= new AbortController()).signal }
      );
    }
  });
};
const activeSlots = () =>
  page.evaluate(() => [0, 1, 2, 3].map((index) => PuiCapabilities.read(`slot${index}`, 'active')));
const resetInputObservations = () =>
  page.evaluate(() => {
    window.__inputAbort?.abort();
    window.__inputAbort = new AbortController();
  });
const drag = async (id, fractionDelta) => {
  const track = await box('track'),
    thumb = await box(id);
  const start = { x: thumb.x + thumb.width / 2 + 3, y: thumb.y + thumb.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await settle();
  await page.mouse.move(start.x + track.width * fractionDelta, start.y, { steps: 3 });
  await settle();
  await page.mouse.up();
  await settle();
};

async function otp(runtime, family, controlled) {
  await mount(runtime, family, 'input-otp', {
    ...(controlled ? { value: '1234' } : { defaultValue: '1234' }),
    withField: true,
  });
  const editor = page.locator('#fixture input').first();
  assert.equal(await editor.inputValue(), '1234');
  await editor.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await settle();
  assert.deepEqual(
    await activeSlots(),
    [false, true, false, false],
    'middle caret chooses the actual slot, not value.length'
  );
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await settle();
  assert.deepEqual(
    await activeSlots(),
    [false, true, true, false],
    'actual selected range chooses covered slots'
  );
  assert.equal(await eventCount('valueChange'), 0, 'selection must not propose an OTP value');
  assert.equal(await eventCount('completed'), 0, 'selection must not complete an OTP');
  const relation = await editor.evaluate((node) => ({
    labelledBy: node.getAttribute('aria-labelledby'),
    describedBy: node.getAttribute('aria-describedby'),
  }));
  assert.ok(
    relation.labelledBy && relation.describedBy,
    'Field relations reach the physical OTP editor'
  );
  await page.keyboard.type('9');
  await settle();
  assert.equal(await read('root', 'value'), controlled ? '1234' : '194');
  assert.equal(
    await editor.inputValue(),
    controlled ? '1234' : '194',
    'physical editor follows the canonical owner after accepted/refused input'
  );
  assert.deepEqual(await read('form', 'getValues'), { code: controlled ? '1234' : '194' });
  if (controlled) {
    assert.equal(
      await eventCount('validationRequest', 'field'),
      0,
      'refused controlled edit must not start validation'
    );
    await page.evaluate(() => PuiCapabilities.acceptValues(true));
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('5678');
    await settle();
    assert.equal(
      await read('root', 'value'),
      '5678',
      'ordinary owner callbacks accept subsequent edits'
    );
    assert.equal(await editor.inputValue(), '5678');
    assert.ok(
      (await eventCount('validationRequest', 'field')) > 0,
      'accepted edit supplies a positive validation control'
    );
  }
  const current = await read('root', 'value');
  await update('root', { readOnly: true });
  await editor.click();
  await page.keyboard.press('Home');
  await page.keyboard.type('0');
  await settle();
  assert.equal(await editor.inputValue(), current);
  assert.equal(await read('root', 'value'), current);
  assert.deepEqual(await activeSlots(), [false, false, false, false]);
  await update('root', { readOnly: false });
  await page.locator('#outside').click();
  await settle();
  assert.deepEqual(
    await activeSlots(),
    [false, false, false, false],
    'blur retires active selection'
  );
  const receipts = await page.evaluate(() => window.__inputFacts);
  assert.ok(
    receipts.some((event) => event.type === 'input' && event.trusted),
    'actual trusted browser input must be observed'
  );
  assert.ok(
    receipts
      .filter((event) => event.type === 'input' || event.type === 'keydown')
      .every((event) => event.trusted)
  );
  return {
    value: await read('root', 'value'),
    active: await activeSlots(),
    relations: relation,
    events: await events(),
    native: receipts,
  };
}

async function slider(runtime, family, controlled) {
  await mount(runtime, family, 'slider-values', {
    ...(controlled ? { value: [20, 80] } : { defaultValue: [20, 80] }),
    withField: true,
  });
  assert.equal(await read('root', 'ready'), true);
  assert.deepEqual(await read('form', 'getValues'), { range: [20, 80] });
  const thumb = await box('thumb0');
  await page.mouse.move(thumb.x + thumb.width / 2 + 3, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await settle();
  assert.deepEqual(await read('root', 'getValue'), [20, 80], 'off-center grab must not jump');
  await page.mouse.up();
  await settle();
  assert.equal(await read('root', 'interacting'), false);
  assert.equal(
    await eventCount('valueCommit'),
    0,
    'no-op release ends the contact without completion'
  );
  await drag('thumb0', 0.1);
  assert.deepEqual(await read('root', 'getValue'), controlled ? [20, 80] : [30, 80]);
  assert.deepEqual(await read('form', 'getValues'), { range: controlled ? [20, 80] : [30, 80] });
  assert.equal(await read('root', 'interacting'), false);
  assert.ok((await eventCount('valueChange')) > 0);
  if (controlled) {
    assert.equal(await eventCount('validationRequest', 'field'), 0);
    assert.equal((await read('field', 'getValidity')).dirty, false);
    await page.evaluate(() => PuiCapabilities.acceptValues(true));
    await drag('thumb0', 0.1);
    assert.deepEqual(
      await read('root', 'getValue'),
      [30, 80],
      'controlled owner can accept a later real contact'
    );
  }
  assert.ok((await eventCount('validationRequest', 'field')) > 0);
  const track = await box('track');
  await page.mouse.click(track.x + track.width * 0.7, track.y + track.height / 2);
  await settle();
  assert.deepEqual(
    await read('root', 'getValue'),
    [30, 70],
    'background seek chooses the nearest editable thumb'
  );
  assert.equal(await read('thumb1', 'focused'), true);
  await page.keyboard.press('ArrowLeft');
  await settle();
  assert.deepEqual(
    await read('root', 'getValue'),
    [30, 69],
    'keyboard takes over the same owner after pointer'
  );
  await update('thumb0', { disabled: true });
  const before = await eventCount('valueChange'),
    disabled = await box('thumb0');
  await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
  await settle();
  assert.equal(
    await eventCount('valueChange'),
    before,
    'disabled origin cannot retarget the other thumb through Track'
  );
  await update('thumb0', { disabled: false });
  await page.locator('.cap-fieldLabel').click();
  await settle();
  assert.equal(await read('thumb0', 'focused'), true, 'group label focuses an enabled thumb');
  const relations = await page.locator('.cap-root').evaluate((node) => ({
    labelledBy: node.getAttribute('aria-labelledby'),
    describedBy: node.getAttribute('aria-describedby'),
    role: node.getAttribute('role'),
  }));
  assert.equal(relations.role, 'group');
  assert.ok(relations.labelledBy && relations.describedBy);
  await update('root', { readOnly: true });
  const value = await read('root', 'getValue');
  await page.keyboard.press('ArrowRight');
  await page.mouse.click(track.x + track.width * 0.4, track.y + track.height / 2);
  await settle();
  assert.deepEqual(await read('root', 'getValue'), value);
  await call('form', 'requestReset');
  assert.deepEqual(
    await read('root', 'getValue'),
    [20, 80],
    'Form reset remains available under editing readOnly policy'
  );
  assert.equal((await read('field', 'getValidity')).dirty, false);
  const receipts = await page.evaluate(() => window.__inputFacts);
  assert.ok(receipts.some((event) => event.type === 'pointerdown' && event.trusted));
  assert.ok(
    receipts
      .filter(
        (event) =>
          event.type === 'pointerdown' || event.type === 'pointerup' || event.type === 'keydown'
      )
      .every((event) => event.trusted)
  );
  return {
    value: await read('root', 'getValue'),
    relations,
    events: await events(),
    native: receipts,
  };
}

async function sliderLifecycle(runtime, family) {
  await mount(runtime, family, 'slider-values', { thumbCollisionBehavior: 'swap' });
  const track = await box('track'),
    thumb = await box('thumb0');
  const x = thumb.x + thumb.width / 2,
    y = thumb.y + thumb.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + track.width * 0.7, y, { steps: 4 });
  await settle();
  assert.deepEqual(await read('root', 'getValue'), [80, 90]);
  assert.equal(await read('root', 'activeIndex'), 1);
  assert.equal(
    await read('thumb1', 'focused'),
    true,
    'swap transfers logical focus without changing the capture owner'
  );
  await update('root', { readOnly: true });
  await page.mouse.up();
  await settle();
  assert.deepEqual(
    await read('root', 'getValue'),
    [80, 90],
    'cancellation retains accepted owner edits'
  );
  assert.equal(await read('root', 'interacting'), false);
  assert.equal(await eventCount('valueCommit'), 0, 'retired physical release cannot commit');
  await update('root', { readOnly: false });
  await call('root', 'resetValue');
  const fresh = await box('thumb0');
  await page.mouse.move(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  await page.mouse.down();
  await settle();
  const before = (await events()).length;
  await page.evaluate(() => PuiCapabilities.cleanup());
  await page.mouse.up();
  await settle();
  assert.equal((await events()).length, before, 'unmounted owner cannot publish a late completion');
  await mount(runtime, family, 'slider-values', { defaultValue: [10, 60] });
  await drag('thumb0', 0.1);
  assert.deepEqual(
    await read('root', 'getValue'),
    [20, 60],
    'replacement owner has a fresh working input lease'
  );
  return { value: await read('root', 'getValue'), events: await events() };
}

async function sliderDirections(runtime, family) {
  const samples = [];
  for (const props of [{ direction: 'rtl' }, { orientation: 'vertical' }]) {
    await resetInputObservations();
    await mount(runtime, family, 'slider-values', props);
    const track = await box('track');
    await page.mouse.click(track.x + track.width * 0.3, track.y + track.height * 0.3);
    await settle();
    assert.deepEqual(
      await read('root', 'getValue'),
      [20, 70],
      `normalized Track position ${JSON.stringify(props)}`
    );
    samples.push({ props, value: await read('root', 'getValue') });
  }
  return { samples };
}

try {
  for (const family of families)
    for (const runtime of runtimes)
      for (const kind of kinds) {
        const cases =
          kind === 'input-otp'
            ? [
                ['uncontrolled', () => otp(runtime, family, false)],
                ['controlled', () => otp(runtime, family, true)],
              ]
            : [
                ['uncontrolled', () => slider(runtime, family, false)],
                ['controlled', () => slider(runtime, family, true)],
                ['lifecycle', () => sliderLifecycle(runtime, family)],
                ['directions', () => sliderDirections(runtime, family)],
              ];
        for (const [scenario, run] of cases) {
          const item = {
            family,
            runtime,
            kind,
            scenario,
            startedAt: new Date().toISOString(),
            status: 'running',
          };
          const beforeErrors = pageErrors.length;
          await page.evaluate(
            ({ family, text }) => {
              document.documentElement.dataset.evidenceFamily = family;
              document.getElementById('scope').textContent = text;
            },
            { family, text: `${family} / ${runtime} / ${kind} / ${scenario}` }
          );
          try {
            await resetInputObservations();
            item.evidence = await run();
            assert.deepEqual(pageErrors.slice(beforeErrors), [], 'consumer page errors');
            item.status = 'passed';
          } catch (error) {
            item.status = 'failed';
            item.error = error.stack ?? String(error);
            item.pageErrors = pageErrors.slice(beforeErrors);
          }
          item.finishedAt = new Date().toISOString();
          item.screenshot = `${family}-${runtime}-${kind}-${scenario}.png`;
          await page.screenshot({ path: path.join(output, item.screenshot), fullPage: true });
          report.cases.push(item);
          await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
          console.log(`${item.status}: ${family}/${runtime}/${kind}/${scenario}`);
          await page.mouse.up().catch(() => {});
          await page
            .evaluate(() => PuiCapabilities.cleanup())
            .catch((error) => {
              item.cleanupError = String(error);
              item.status = 'failed';
            });
        }
      }
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.passed = report.cases.filter((item) => item.status === 'passed').length;
  report.failed = report.cases.filter((item) => item.status !== 'passed').length;
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ output, passed: report.passed, failed: report.failed }));
if (report.failed) process.exitCode = 1;
