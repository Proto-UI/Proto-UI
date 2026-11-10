import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    viewport: { type: 'string', default: 'wide' },
    'color-scheme': { type: 'string', default: 'light' },
    'negative-control': { type: 'string', default: 'none' },
  },
});
assert.ok(values.url && values.out, 'Required: --url http://127.0.0.1:PORT --out NEW_DIRECTORY');
const target = new URL(values.url);
assert.ok(target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
assert.equal(target.href, `${target.origin}${target.pathname}`, 'Use a local URL without credentials, query or fragment');
assert.ok(['wide', 'narrow'].includes(values.viewport));
assert.ok(['light', 'dark'].includes(values['color-scheme']));
assert.ok(['none', 'automatic', 'relationship', 'removal'].includes(values['negative-control']));

const out = path.resolve(values.out);
const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['package.json', 'package-lock.json', 'index.html', 'src/main.jsx', 'src/style.css', 'check.mjs'];
const planned = [
  'controls', 'initial-selection', 'keyboard-entry', 'right-skips-disabled', 'right-to-last',
  'right-wraps', 'left-wraps', 'home', 'end', 'enter-activates', 'home-keeps-selection',
  'space-activates', 'pointer-activates', 'disabled-does-not-activate', 'repeated-selections',
  'tab-leaves-list', 'tab-reaches-host', 'removal', 'keyboard-after-removal', 'host-action',
  'runtime-errors', 'source-stability',
];
const report = {
  schemaVersion: 1,
  kind: 'interaction-knowledge-consumer-observation',
  scope: 'Public development consumer only; not a formal benchmark result or Proto conformance claim.',
  caseId: 'tabs-manual-activation',
  taskExtension: 'After fixture increments a visible, politely announced action count starting at zero.',
  url: target.href,
  startedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  architecture: process.arch,
  viewport: values.viewport === 'wide' ? { width: 1280, height: 800 } : { width: 390, height: 844 },
  colorScheme: values['color-scheme'],
  injectedControl: values['negative-control'],
  browserVersion: null,
  checks: planned.map((id) => ({ id, status: 'not-run' })),
  source: [],
  artifacts: [],
  runtimeErrors: [],
  cleanupErrors: [],
  limitations: [
    'Public authored library recipe; not a model output, independently reviewed oracle, blind/held-out run or knowledge-value comparison.',
    'Only the six declared example/evaluator files are captured; no complete transitive source or dependency archive is claimed.',
    'Computed layout and accessibility snapshots do not establish paint contrast, screen-reader behavior or other-host conformance.',
    'A killed process may leave start.json and partial evidence without report.json; retain that incomplete attempt.',
  ],
};
await mkdir(out);
await mkdir(path.join(out, 'source'));
for (const relative of sourcePaths) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const saved = `source/${relative}`;
  await mkdir(path.dirname(path.join(out, saved)), { recursive: true });
  await writeFile(path.join(out, saved), bytes, { flag: 'wx' });
  report.source.push({ path: relative, sha256: sha256(bytes), bytes: bytes.length });
}
await writeFile(path.join(out, 'start.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });

let browser;
let context;
let page;
let failure;
let tracing = false;
const errorText = (error) => error instanceof Error ? error.stack || error.message : String(error);

async function check(id, action) {
  const row = report.checks.find((entry) => entry.id === id);
  row.startedAt = new Date().toISOString();
  try {
    await action();
    row.status = 'passed';
  } catch (error) {
    row.status = 'failed';
    row.error = errorText(error);
    throw error;
  } finally {
    row.finishedAt = new Date().toISOString();
  }
}

async function save(relative, bytes) {
  const content = Buffer.from(bytes);
  await writeFile(path.join(out, relative), content, { flag: 'wx' });
  report.artifacts.push({ path: relative, sha256: sha256(content), bytes: content.length });
}

async function capture(name) {
  await save(`${name}.html`, await page.content());
  await save(`${name}.aria.yml`, await page.locator('body').ariaSnapshot());
  await save(`${name}.png`, await page.screenshot({ fullPage: true, timeout: 5000 }));
  await save(`${name}.json`, JSON.stringify(await page.evaluate(() => ({
    activeElement: { role: document.activeElement?.getAttribute('role'), text: document.activeElement?.textContent, id: document.activeElement?.id },
    tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
      text: tab.textContent, selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex,
      controls: tab.getAttribute('aria-controls'), disabled: tab.matches(':disabled') || tab.getAttribute('aria-disabled') === 'true',
    })),
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  })), null, 2) + '\n');
}

// Wait for the actual DOM invariant; an animation-frame count is not a React commit barrier.
async function state(selectedName, focusedName) {
  await page.waitForFunction(({ selectedName, focusedName }) => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
    const visiblePanels = [...document.querySelectorAll('[role="tabpanel"]')].filter((panel) => !panel.hidden && panel.getClientRects().length > 0 && getComputedStyle(panel).visibility === 'visible');
    const current = selected[0];
    const panel = visiblePanels[0];
    const focus = document.activeElement;
    const stops = tabs.filter((tab) => !tab.matches(':disabled') && tab.getAttribute('aria-disabled') !== 'true' && tab.tabIndex === 0);
    return tabs.length === 4 && selected.length === 1 && current.textContent.trim() === selectedName &&
      visiblePanels.length === 1 && panel.id && current.getAttribute('aria-controls') === panel.id &&
      panel.getAttribute('aria-labelledby')?.split(/\s+/).includes(current.id) &&
      (!focusedName || (focus?.getAttribute('role') === 'tab' && focus.textContent.trim() === focusedName && stops.length === 1 && stops[0] === focus));
  }, { selectedName, focusedName }, { timeout: 2500 });
  assert.equal(await page.getByRole('tabpanel', { name: selectedName, exact: true }).count(), 1);
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true, timeout: 15000 });
  report.browserVersion = browser.version();
  context = await browser.newContext({ viewport: report.viewport, colorScheme: report.colorScheme });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;
  page = await context.newPage();
  page.setDefaultTimeout(2500);
  page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', (error) => report.runtimeErrors.push({ type: 'pageerror', text: error.message }));
  page.on('console', (message) => { if (message.type() === 'error') report.runtimeErrors.push({ type: 'console', text: message.text() }); });
  const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, 'Consumer document must load successfully');
  const list = page.getByRole('tablist', { name: 'Reference sections', exact: true });
  const tab = (name) => list.getByRole('tab', { name, exact: true });
  const remove = page.getByRole('button', { name: 'Remove reference fixture', exact: true });
  const after = page.getByRole('button', { name: 'After fixture', exact: true });
  await list.waitFor({ state: 'visible' });

  if (values['negative-control'] === 'automatic') {
    await list.evaluate((element) => element.addEventListener('focusin', (event) => {
      if (event.target.getAttribute('role') === 'tab') event.target.click();
    }));
  } else if (values['negative-control'] === 'relationship') {
    await tab('Overview').evaluate((element) => element.removeAttribute('aria-controls'));
  } else if (values['negative-control'] === 'removal') {
    await remove.evaluate((element) => element.addEventListener('click', (event) => event.stopImmediatePropagation(), true));
  }

  await check('controls', async () => {
    assert.equal(await list.count(), 1);
    assert.deepEqual((await list.getByRole('tab').allTextContents()).map((text) => text.trim()), ['Overview', 'Unavailable', 'Details', 'History']);
    assert.ok([null, 'horizontal'].includes(await list.getAttribute('aria-orientation')));
    assert.equal(await tab('Unavailable').isDisabled(), true);
    for (const name of ['Overview', 'Details', 'History']) assert.equal(await tab(name).isEnabled(), true);
    assert.equal(await remove.count(), 1);
    assert.equal(await after.count(), 1);
  });
  await check('initial-selection', () => state('Overview'));
  await capture('01-initial');
  await check('keyboard-entry', async () => { await page.keyboard.press('Tab'); await state('Overview', 'Overview'); });
  await check('right-skips-disabled', async () => { await page.keyboard.press('ArrowRight'); await state('Overview', 'Details'); });
  await capture('02-focus-without-selection');
  await check('right-to-last', async () => { await page.keyboard.press('ArrowRight'); await state('Overview', 'History'); });
  await check('right-wraps', async () => { await page.keyboard.press('ArrowRight'); await state('Overview', 'Overview'); });
  await check('left-wraps', async () => { await page.keyboard.press('ArrowLeft'); await state('Overview', 'History'); });
  await check('home', async () => { await page.keyboard.press('Home'); await state('Overview', 'Overview'); });
  await check('end', async () => { await page.keyboard.press('End'); await state('Overview', 'History'); });
  await check('enter-activates', async () => { await page.keyboard.press('Enter'); await state('History', 'History'); });
  await capture('03-activated');
  await check('home-keeps-selection', async () => { await page.keyboard.press('Home'); await state('History', 'Overview'); });
  await check('space-activates', async () => { await page.keyboard.press('Space'); await state('Overview', 'Overview'); });
  await check('pointer-activates', async () => { await tab('Details').click(); await state('Details', 'Details'); });
  await check('disabled-does-not-activate', async () => { await tab('Unavailable').click({ force: true }); await state('Details'); });
  await check('repeated-selections', async () => {
    for (const name of ['Overview', 'Details', 'History', 'Overview']) { await tab(name).click(); await state(name, name); }
    assert.equal(await list.getByRole('tab').count(), 4);
    assert.equal(await page.getByRole('tabpanel', { includeHidden: true }).count(), 4);
  });
  await check('tab-leaves-list', async () => {
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('tabpanel', { name: 'Overview', exact: true }).evaluate((element) => element === document.activeElement), true);
  });
  await check('tab-reaches-host', async () => {
    await page.keyboard.press('Tab');
    assert.equal(await remove.evaluate((element) => element === document.activeElement), true);
  });
  await check('removal', async () => {
    await page.keyboard.press('Enter');
    await list.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('tab', { includeHidden: true }).count(), 0);
    assert.equal(await page.getByRole('tabpanel', { includeHidden: true }).count(), 0);
  });
  await check('keyboard-after-removal', async () => {
    await page.keyboard.press('Tab');
    assert.equal(await after.evaluate((element) => element === document.activeElement), true);
  });
  await check('host-action', async () => {
    await page.keyboard.press('Enter');
    await page.getByRole('status').filter({ hasText: /^After fixture action count: 1$/ }).waitFor({ state: 'visible' });
  });
  await capture('04-host-after-removal');
  await check('runtime-errors', () => assert.deepEqual(report.runtimeErrors, []));
  await check('source-stability', async () => {
    for (const file of report.source) assert.equal(sha256(await readFile(path.join(sourceRoot, file.path))), file.sha256, `Source changed: ${file.path}`);
  });
} catch (error) {
  failure = errorText(error);
  if (page) {
    try { await capture('failure'); } catch (captureError) { report.captureError = errorText(captureError); }
  }
} finally {
  if (tracing) {
    try {
      await context.tracing.stop({ path: path.join(out, 'trace.zip') });
      const bytes = await readFile(path.join(out, 'trace.zip'));
      report.artifacts.push({ path: 'trace.zip', sha256: sha256(bytes), bytes: bytes.length });
    } catch (error) { report.cleanupErrors.push(errorText(error)); }
  }
  if (browser) {
    try { await browser.close(); } catch (error) { report.cleanupErrors.push(errorText(error)); }
  }
}
report.finishedAt = new Date().toISOString();
report.failure = failure ?? null;
report.outcome = failure !== undefined || report.cleanupErrors.length > 0 ? 'failed' : 'passed';
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ outcome: report.outcome, injectedControl: report.injectedControl, passed: report.checks.filter((row) => row.status === 'passed').length, planned: planned.length, report: path.join(out, 'report.json') }));
process.exitCode = report.outcome === 'passed' ? 0 : 1;
