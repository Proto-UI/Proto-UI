/**
 * Native browser acceptance of the actual Sprint 2 public Form, Field choices and Select recipes.
 * Prerequisite: corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style
 * Run: node --import tsx scripts/analysis/form-select-recipes-browser.mjs
 * CHROME_PATH / PUI_CHROME_EXECUTABLE selects Chrome; PUI_EVIDENCE_DIR selects output.
 * PUI_BROWSER_FAMILIES/RUNTIMES/KINDS optionally bound a diagnostic run.
 */
import assert from 'node:assert/strict';
import { assertNativeRecipeInputs, partitionRecipeInputs } from './recipe-input-verification.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { renderBrutalistThemeCss } from '../../packages/prototypes/brutalist/src/theme.ts';
import { readCollectionsSourceInventory } from './collections-source-inventory.mjs';
import { readFormSelectRecipeCss } from './form-select-recipe-css.mjs';

const select = (key, defaults) => process.env[key]?.split(',').filter(Boolean) ?? defaults;
const families = select('PUI_BROWSER_FAMILIES', ['base', 'shadcn', 'brutalist']);
const runtimes = select('PUI_BROWSER_RUNTIMES', ['wc', 'react', 'vue', 'vue2']);
const kinds = select('PUI_BROWSER_KINDS', ['form', 'select', 'choices']);
const output = path.resolve(process.env.PUI_EVIDENCE_DIR ?? '.tmp/form-select-recipes-browser');
await mkdir(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const inventory = await readCollectionsSourceInventory();
const report = {
  kind: 'form-select-public-recipes-native-chromium',
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
    'Actual public DemoSpecs, real Web Adapters/frameworks, generated prototype CSS and the ordinary Tailwind consumer stylesheet/fonts. Native Chromium keyboard/mouse and CDP-emulated trusted touch/pen. Touch cancellation and implicit capture are observed separately; this is not physical hardware acceptance. Runtime assets are bundled locally; import retry, physical hardware, screen readers, non-Web and compiler parity are separate acceptance.',
  cases: [],
};
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/form-select-recipes-browser.ts'],
  bundle: true,
  write: false,
  outfile: path.join(output, 'consumer.js'),
  format: 'iife',
  globalName: 'PuiFormSelect',
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
const [theme, tokens] = await Promise.all([
  readFile('apps/www/src/styles/shadcn-theme.css', 'utf8'),
  readFile('apps/www/src/styles/proto-ui-tokens.generated.css', 'utf8'),
]);
const consumerStyles = await readFormSelectRecipeCss();
report.source.consumerStyles = consumerStyles.receipt;
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
const page = await browser.newPage({
  viewport: report.environment.viewport,
  colorScheme: 'light',
  hasTouch: true,
});
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.setContent(
  '<!doctype html><html data-theme="light"><head><meta charset="utf-8"></head><body><main><h1>Proto UI · Form, choices and Select recipes</h1><p id="scope"></p><div id="fixture"></div></main></body></html>'
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
const settle = () => page.evaluate(() => PuiFormSelect.settle());
const read = (ref, path, ...args) =>
  page.evaluate(([ref, path, args]) => PuiFormSelect.read(ref, path, ...args), [ref, path, args]);
const props = async (ref, value) => {
  await page.evaluate(([ref, value]) => PuiFormSelect.setProps(ref, value), [ref, value]);
  await settle();
};
const until = (ref, path, expected) =>
  page.waitForFunction(
    ([ref, path, expected]) =>
      JSON.stringify(PuiFormSelect.read(ref, path)) === JSON.stringify(expected),
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
  await page.screenshot({ path: path.join(output, file), fullPage: true });
  return file;
};

const click = async (name) => {
  await ref(name).click();
  await settle();
};
const editor = (name, tag = 'input') =>
  ref(name)
    .locator(tag)
    .or(ref(name).and(page.locator(tag)));
async function validationReceipt({ old = false, minimum = 1 } = {}) {
  const receipt = JSON.parse(await ref('validationResults').textContent());
  const observed = await page.evaluate(() => PuiFormSelect.validationDeliveries());
  assert.ok(receipt.results.length >= minimum, 'public receipt contains actual delivered requests');
  for (const result of receipt.results) {
    assert.equal(typeof result.requestId, 'string');
    assert.equal(typeof result.accepted, 'boolean');
    assert.notEqual(result.value, 'rejected', 'validator receives canonical owner values');
  }
  if (receipt.results.length)
    assert.deepEqual(
      receipt.results.map(({ requestId, accepted }) => ({ requestId, accepted })),
      observed.slice(-receipt.results.length),
      'public receipt matches independently observed real resolveValidation returns'
    );
  if (old) {
    assert.equal(receipt.kind, 'old-results');
    assert.deepEqual(
      receipt.before,
      receipt.after,
      'stale results leave the current request and validity unchanged'
    );
    for (const result of receipt.results) {
      assert.equal(result.accepted, false, 'every delivered old request is actually rejected');
      if (receipt.before.validity.pending)
        assert.notEqual(result.requestId, receipt.before.latestRequest.requestId);
    }
    assert.equal(receipt.summary, `old-results ${receipt.results.map(() => 'stale').join(',')}`);
  }
  return receipt;
}
async function form(prefix) {
  const account = editor('accountControl');
  const notes = editor('notes', 'textarea');
  await until('form', 'getValues', {
    account: 'ada',
    channels: ['email'],
    notes: 'Keep this multiline note.',
  });
  assert.equal(
    await account.getAttribute('aria-labelledby'),
    await ref('accountLabel').getAttribute('id')
  );
  assert.equal(
    await ref('outerGroup').getAttribute('aria-labelledby'),
    await ref('outerLegend').getAttribute('id')
  );
  assert.equal(
    await ref('innerGroup').getAttribute('aria-labelledby'),
    await ref('innerLegend').getAttribute('id')
  );
  await ref('accountLabel').click();
  assert.equal(
    await account.evaluate(
      (element) => (element.getRootNode().activeElement ?? document.activeElement) === element
    ),
    true
  );
  await account.fill('grace');
  await settle();
  assert.equal((await read('accountField', 'getValidity')).pending, true);
  assert.equal((await read('form', 'getValues')).account, 'grace');
  await click('toggleOwner');
  await account.fill('rejected');
  await settle();
  assert.equal(await account.inputValue(), 'grace');
  assert.equal((await read('form', 'getValues')).account, 'grace');
  assert.match(await ref('validatorStatus').textContent(), /value="grace"/);
  await click('toggleOwner');
  await account.fill('lin');
  await settle();
  await click('staleResult');
  const oldResults = await validationReceipt({ old: true });
  assert.match(oldResults.summary, /^old-results stale(?:,stale)*$/);
  assert.equal(oldResults.before.validity.pending, true);
  assert.equal(oldResults.before.latestRequest.value, 'lin');
  assert.equal((await read('accountField', 'getValidity')).pending, true);
  await click('rejectResult');
  const rejected = await validationReceipt();
  assert.equal(rejected.results.length, 1);
  assert.equal(rejected.results[0].accepted, true);
  assert.equal(rejected.results[0].value, 'lin');
  assert.equal((await read('accountField', 'getValidity')).invalid, true);
  assert.equal(
    await account.getAttribute('aria-errormessage'),
    await ref('accountError').getAttribute('id')
  );
  const invalid = await capture(`${prefix}-invalid`);
  // A native change on leaving the editor can have superseded a request
  // after the first delivery. Deliver that remaining old request as well,
  // preserving the invalid result and isolating the next two submit attempts.
  await click('staleResult');
  const afterCommit = await validationReceipt({ old: true, minimum: 0 });
  assert.equal((await read('accountField', 'getValidity')).invalid, true);
  assert.equal((await read('accountField', 'getValidity')).pending, false);
  await click('submit');
  await until('form', 'pending.get', true);
  const first = await ref('validatorStatus').textContent();
  await page.evaluate(() => PuiFormSelect.call('form', 'requestSubmit'));
  await settle();
  assert.notEqual(await ref('validatorStatus').textContent(), first);
  await click('staleResult');
  const supersededSubmit = await validationReceipt({ old: true });
  assert.equal(supersededSubmit.summary, 'old-results stale');
  assert.equal(await read('form', 'pending.get'), true);
  await click('acceptResult');
  const accepted = await validationReceipt();
  assert.equal(accepted.results.length, 1);
  assert.equal(accepted.results[0].accepted, true);
  assert.match(await ref('submissionStatus').textContent(), /submitted=1.*"account":"lin"/);
  assert.equal(await account.getAttribute('aria-errormessage'), null);
  await click('submit');
  await until('form', 'pending.get', true);
  await click('cancelSubmit');
  await click('acceptResult');
  assert.equal(await ref('submissionStatus').textContent(), 'canceled');
  await notes.fill('Edited\nmultiline');
  await settle();
  assert.equal((await read('form', 'getValues')).notes, 'Edited\nmultiline');
  await click('toggleReadOnly');
  assert.equal(await account.evaluate((element) => element.readOnly), true);
  assert.equal(await notes.evaluate((element) => element.readOnly), true);
  await account.focus();
  await page.keyboard.press('End');
  await page.keyboard.type('x');
  await settle();
  assert.equal(await account.inputValue(), 'lin');
  await click('toggleDisabled');
  assert.deepEqual(await read('form', 'getValues'), { account: 'lin' });
  assert.equal(await read('channelsField', 'disabled.get'), true);
  assert.equal(await notes.isDisabled(), true);
  await click('toggleDisabled');
  await click('sms');
  assert.deepEqual(await read('channels', 'getValue'), ['email', 'sms']);
  assert.equal(await ref('allChannels').getAttribute('aria-checked'), 'true');
  await click('reset');
  await until('form', 'getValues', {
    account: 'ada',
    channels: ['email'],
    notes: 'Keep this multiline note.',
  });
  assert.equal(await account.evaluate((element) => element.readOnly), true);
  assert.equal(await notes.inputValue(), 'Keep this multiline note.');
  assert.equal((await read('accountField', 'getValidity')).status, 'unvalidated');
  assert.equal(await ref('submissionStatus').textContent(), 'reset');
  return {
    checks: [
      'native label focus and Fieldset naming',
      'controlled owner accept/refuse',
      'latest validation request and stale-result rejection',
      'actual result returns retained separately from later pending requests',
      'failure and retry',
      'new submission supersedes old attempt',
      'canceled submission stays canceled',
      'readonly editing and reset',
      'nested disabled canonical value omission',
      'CheckboxGroup aggregate, reset and multiline restoration',
    ],
    validationReceipts: [oldResults, rejected, afterCommit, supersededSubmit, accepted],
    pictures: [invalid, await capture(`${prefix}-reset`)],
  };
}

async function choices(prefix) {
  const initial = { agreement: false, plan: '', alerts: false };
  const chosen = { agreement: true, plan: 'pro', alerts: true };
  const values = () => read('choiceForm', 'getValues');
  const focused = (name) =>
    ref(name).evaluate(
      (node) => (node.getRootNode().activeElement ?? document.activeElement) === node
    );
  const proposals = async () =>
    Number(/proposals=(\d+)/.exec(await ref('choiceStatus').textContent())[1]);
  const retain = (key) => page.evaluate((key) => PuiFormSelect.retain('agreement', key), key);
  const retired = async (key) => {
    const result = await page.evaluate((key) => PuiFormSelect.retired(key), key);
    assert.equal(result.connected, false, 'old public control is actually removed');
    assert.match(result.readError, /terminal disposal/, 'old owner exposes are terminal');
    return result;
  };
  await until('choiceForm', 'getValues', initial);
  assert.equal(await ref('agreement').getAttribute('aria-checked'), 'mixed');
  assert.equal(
    await ref('agreement').getAttribute('aria-labelledby'),
    await ref('agreeLabel').getAttribute('id')
  );
  assert.equal(
    await ref('plan').getAttribute('aria-labelledby'),
    await ref('planLabel').getAttribute('id')
  );
  assert.equal(
    await ref('choiceGroup').getAttribute('aria-labelledby'),
    await ref('choiceLegend').getAttribute('id')
  );
  await click('choiceSubmit');
  assert.equal(await ref('choiceSubmission').textContent(), 'required values missing');
  assert.equal((await read('agreeField', 'getValidity')).invalid, true);
  assert.equal((await read('planField', 'getValidity')).invalid, true);
  assert.equal(
    await ref('agreement').getAttribute('aria-errormessage'),
    await ref('agreeError').getAttribute('id')
  );
  assert.equal(
    await ref('plan').getAttribute('aria-errormessage'),
    await ref('planError').getAttribute('id')
  );
  const invalid = await capture(`${prefix}-required`);
  await click('choiceToggleOwner');
  const beforeRefusal = await proposals();
  await click('agreement');
  await click('plan-basic');
  assert.deepEqual(await values(), initial);
  assert.equal(await proposals(), beforeRefusal + 2);
  assert.equal(await read('agreeField', 'dirty.get'), false);
  assert.equal(await read('planField', 'dirty.get'), false);
  await click('choiceToggleOwner');
  await click('agreement');
  await click('plan-pro');
  await click('alerts');
  await until('choiceForm', 'getValues', chosen);
  assert.equal(await ref('agreement').getAttribute('aria-checked'), 'true');
  assert.equal((await read('agreeField', 'getValidity')).invalid, false);
  assert.equal((await read('planField', 'getValidity')).invalid, false);
  await click('choiceReadOnly');
  const beforeReadonly = await proposals();
  await click('agreeLabel');
  assert.equal(await focused('agreement'), true);
  await page.keyboard.press('Space');
  await settle();
  await click('planLabel');
  assert.equal(await focused('plan-pro'), true);
  const touched = await read('planField', 'touched.get');
  await page.keyboard.press('ArrowLeft');
  await settle();
  assert.equal(await focused('plan-basic'), true);
  assert.equal(
    await read('planField', 'touched.get'),
    touched,
    'internal group focus migration is not blur'
  );
  await click('alertsLabel');
  assert.equal(await focused('alerts'), true);
  await page.keyboard.press('Space');
  await settle();
  assert.equal(
    await proposals(),
    beforeReadonly,
    'readonly retains focus without any value proposal'
  );
  assert.deepEqual(await values(), chosen);
  const readonly = await capture(`${prefix}-readonly`);
  await click('choiceDisabled');
  assert.deepEqual(await values(), {});
  assert.equal(await ref('agreement').getAttribute('aria-disabled'), 'true');
  assert.equal(await ref('plan-basic').getAttribute('aria-disabled'), 'true');
  await click('choiceDisabled');
  assert.deepEqual(await values(), chosen);
  await click('choiceToggleOwner');
  await click('choiceReset');
  assert.deepEqual(await values(), { agreement: true, plan: 'pro', alerts: false });
  assert.equal(await read('agreeField', 'dirty.get'), true);
  assert.equal(await read('planField', 'dirty.get'), true);
  await click('choiceToggleOwner');
  await click('choiceReset');
  await until('choiceForm', 'getValues', initial);
  assert.equal(await read('agreeField', 'dirty.get'), false);
  assert.equal(await read('planField', 'dirty.get'), false);
  assert.equal(await read('agreement', 'readOnly.get'), true);
  await click('choiceReadOnly');
  await click('choiceHold');
  await click('agreement');
  assert.equal((await values()).agreement, false);
  assert.equal(await ref('choiceHeld').textContent(), 'held revision=1');
  await retain('held-response');
  await click('choiceReplace');
  await page.waitForFunction(() =>
    document.querySelector('[data-demo-ref="choiceStatus"]').textContent.includes('revision=2')
  );
  await click('choiceDeliver');
  assert.equal(await ref('choiceHeld').textContent(), 'stale revision=1 current=2');
  assert.deepEqual(await values(), initial);
  const heldOwner = await retired('held-response');
  await retain('callback-replacement');
  await click('choiceReplaceOnRequest');
  const beforeReplacement = await proposals();
  await click('agreement');
  await page.waitForFunction(() =>
    document.querySelector('[data-demo-ref="choiceStatus"]').textContent.includes('revision=3')
  );
  await settle();
  assert.deepEqual(await values(), initial);
  assert.equal(
    await proposals(),
    beforeReplacement + 1,
    'retired owner emits no trailing proposal'
  );
  const callbackOwner = await retired('callback-replacement');
  await click('agreement');
  await click('plan-basic');
  await click('choiceSubmit');
  assert.match(
    await ref('choiceSubmission').textContent(),
    /submitted=1.*"agreement":true.*"plan":"basic"/
  );
  return {
    checks: [
      'explicit checkbox/radio/switch Field compositions and exact IDREFs',
      'false/mixed and empty string retain required oracle',
      'controlled refusal and ordinary queued acceptance',
      'readonly Label/Space focus and radio roving without proposals',
      'same-group focus migration is not blur',
      'nested Fieldset disabled omits canonical values without rewriting owners',
      'controlled reset refusal preserves value and dirty; accepted reset restores creation baseline',
      'held owner response cannot update replacement controls',
      'replacement during outward value request retires old owner and trailing proposal',
      'new owner remains usable and Form submits actual named canonical values',
    ],
    retiredOwners: { heldOwner, callbackOwner },
    pictures: [invalid, readonly, await capture(`${prefix}-new-owner-submit`)],
  };
}

async function selectInput(prefix) {
  const content = ref('selectContent');
  const scroll = prefix.startsWith('brutalist-') ? content : ref('selectViewport');
  const center = async (name) => {
    const box = await ref(name).boundingBox();
    assert.ok(box, `visible ${name}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const move = async (name) => {
    const point = await center(name);
    await page.mouse.move(point.x, point.y);
    await settle();
  };
  const selected = async (index) => {
    assert.equal(await ref(`item${index}`).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[data-demo-ref^="item"][aria-selected="true"]').count(), 1);
  };
  const reopen = async () => {
    if (await read('select', 'open.get')) {
      await page.keyboard.press('Escape');
      await until('select', 'open.get', false);
    }
    await click('selectTrigger');
    await until('select', 'open.get', true);
    await settle();
  };
  await reopen();
  await until('item0', 'focused.get', true);
  await selected(0);
  await page.keyboard.press('ArrowDown');
  await until('item1', 'focused.get', true);
  assert.equal(await read('select', 'value.get'), 'alpha');
  await move('item2');
  await until('item2', 'focused.get', true);
  assert.equal(await read('item1', 'active.get'), false);
  await selected(0);
  const handoff = await capture(`${prefix}-mouse-keyboard`);
  await move('item0');
  await until('item0', 'focused.get', true);
  await page.mouse.down();
  await move('item1');
  assert.equal(await read('item1', 'focused.get'), false);
  assert.equal(await read('select', 'value.get'), 'alpha');
  await page.mouse.up();
  await settle();
  assert.equal(await read('select', 'value.get'), 'alpha');
  const session = await page.context().newCDPSession(page);
  const touch = (type, points = []) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  let lateMove = {};
  try {
    await move('item0');
    const beta = await center('item1');
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      pointerType: 'pen',
      x: beta.x,
      y: beta.y,
      button: 'none',
      buttons: 0,
    });
    await settle();
    assert.equal(
      await read('item1', 'focused.get'),
      false,
      'pen hover cannot use mouse focus navigation'
    );
    await page.keyboard.press('Escape');
    await until('select', 'open.get', false);
    await click('toggleRefusal');
    await reopen();
    await until('item0', 'focused.get', true);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle();
    assert.equal(await read('select', 'value.get'), 'alpha');
    assert.match(await ref('selectRequests').textContent(), /requested=beta/);
    await reopen();
    await until('item0', 'focused.get', true);
    const start = await center('item0');
    const touchStart = (await page.evaluate(() => PuiFormSelect.receipts())).length;
    await touch('touchStart', [{ id: 1, x: start.x, y: start.y }]);
    await touch('touchMove', [{ id: 1, x: start.x + 2, y: start.y + 2 }]);
    await touch('touchCancel');
    await settle();
    const canceled = (await page.evaluate(() => PuiFormSelect.receipts())).slice(touchStart);
    assert.ok(
      canceled.some(
        (event) => event.type === 'pointerdown' && event.pointerType === 'touch' && event.trusted
      )
    );
    assert.ok(
      canceled.some(
        (event) => event.type === 'pointercancel' && event.pointerType === 'touch' && event.trusted
      )
    );
    assert.ok(
      canceled.some((event) => event.type === 'gotpointercapture'),
      'UA implicit capture must be observed'
    );
    assert.equal(await read('select', 'value.get'), 'alpha');
    const beforeLate = (await page.evaluate(() => PuiFormSelect.receipts())).length;
    try {
      await touch('touchMove', [{ id: 1, x: beta.x, y: beta.y }]);
      lateMove = { protocolAccepted: true };
    } catch (error) {
      lateMove = { protocolAccepted: false, protocolError: String(error) };
    }
    await settle();
    lateMove.deliveries = (await page.evaluate(() => PuiFormSelect.receipts())).slice(beforeLate);
    assert.equal(await read('select', 'value.get'), 'alpha');
    assert.equal(await read('item1', 'focused.get'), false, 'late touch cannot become mouse hover');
    // A late touchMove may be rejected by Chromium because no pointer is active.
    // It creates no new touch sequence, so a second cancel would test an invalid CDP command.
    await reopen();
    await scroll.evaluate((element) => {
      element.scrollTop = 0;
    });
    const box = await scroll.boundingBox();
    assert.ok(box);
    const gesture = { x: box.x + box.width / 2, y: box.y + box.height - 18 };
    const beforeScroll = (await page.evaluate(() => PuiFormSelect.receipts())).length;
    await touch('touchStart', [{ id: 2, ...gesture }]);
    for (let index = 1; index <= 8; index++) {
      await touch('touchMove', [{ id: 2, x: gesture.x, y: gesture.y - index * 12 }]);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await touch('touchEnd');
    await settle();
    const scrollTop = await scroll.evaluate((element) => element.scrollTop);
    assert.ok(scrollTop > 0, 'native touch pans the actual public viewport');
    const scrolling = (await page.evaluate(() => PuiFormSelect.receipts())).slice(beforeScroll);
    assert.ok(
      scrolling.some((event) => event.type === 'pointercancel'),
      'UA scrolling cancels the pointer sequence'
    );
    assert.equal(await read('select', 'value.get'), 'alpha');
    const scrolled = await capture(`${prefix}-native-touch-scroll`);
    await page.keyboard.press('Escape');
    await until('select', 'open.get', false);
    await click('toggleRefusal');
    await reopen();
    await until('item0', 'focused.get', true);
    const tap = await center('item1');
    await touch('touchStart', [{ id: 3, ...tap }]);
    await touch('touchEnd');
    await settle();
    await until('select', 'value.get', 'beta');
    await reopen();
    await until('item1', 'focused.get', true);
    await selected(1);
    return {
      checks: [
        'native keyboard/mouse single focus owner',
        'held-button crossing rejection',
        'pen hover exclusion',
        'controlled keyboard selection refusal',
        'trusted touch cancel and implicit capture observations',
        'late touch delivery classified separately from consumer rejection',
        'actual touch scroll with UA pointer cancel',
        'valid touch tap',
        'committed selected entry after close/reopen',
      ],
      touchCancel: canceled,
      touchScroll: { scrollTop, deliveries: scrolling },
      lateMove,
      pictures: [handoff, scrolled, await capture(`${prefix}-reopened`)],
    };
  } finally {
    await session.detach();
  }
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
              return PuiFormSelect.mount(runtime, family, kind);
            },
            [runtime, family, kind]
          );
          Object.assign(result, await { form, select: selectInput, choices }[kind](prefix));
          result.inputs = await page.evaluate(() => PuiFormSelect.receipts());
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
            result.inputs = await page.evaluate(() => PuiFormSelect.receipts());
            Object.assign(result, partitionRecipeInputs(result.inputs));
            result.validationDeliveries = await page.evaluate(() =>
              PuiFormSelect.validationDeliveries()
            );
            assert.deepEqual(await page.evaluate(() => PuiFormSelect.dispose()), {
              hostChildren: 0,
              retiredContentConnected: false,
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
  `Form/Select public recipes: ${report.passed}/${report.cases.length}; ${path.join(output, 'report.json')}`
);
if (report.failed) process.exitCode = 1;
