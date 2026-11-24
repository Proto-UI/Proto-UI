// Independent operator observation of the original preference-saving task.
// This records an actual submitted production build; it does not repair it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const [projectArgument, url, outputArgument, selectorArgument] = process.argv.slice(2);
assert.ok(projectArgument && url && outputArgument);
const project = fs.realpathSync(projectArgument);
const output = path.resolve(outputArgument);
assert.ok(!fs.existsSync(output), 'Retain each attempt in a new directory');
fs.mkdirSync(output, { recursive: true });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const selectors = selectorArgument
  ? JSON.parse(fs.readFileSync(selectorArgument, 'utf8'))
  : {
      action: '.save-button',
      savedName: '.saved-name strong',
      busy: '.save-action',
    };
for (const key of ['action', 'savedName', 'busy'])
  assert.ok(typeof selectors[key] === 'string' && selectors[key]);
const require = createRequire(path.join(project, 'package.json'));
const { chromium } = require('playwright-core');
const result = {
  schemaVersion: 1,
  kind: 'independent-production-preference-task-observation',
  startedAt: new Date().toISOString(),
  project,
  url,
  observerSha256: hash(fs.readFileSync(new URL(import.meta.url))),
  selectors,
  selectorConfigSha256: selectorArgument ? hash(fs.readFileSync(selectorArgument)) : null,
  node: process.version,
  scope: 'Original supplied preference task; no AT, other-host or released-package claim',
  checkpoints: [],
  assets: [],
  errors: [],
  status: 'running',
};
const write = (filename, value) => fs.writeFileSync(path.join(output, filename), value);
write('start.json', JSON.stringify(result, null, 2) + '\n');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  chromiumSandbox: true,
});
let context;
try {
  result.browser = browser.version();
  context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    window.__preferenceWrites = [];
    Storage.prototype.setItem = function (key, value) {
      const answer = original.call(this, key, value);
      if (this === localStorage && key === 'consumer-study-preferences') {
        window.__preferenceWrites.push({ atMs: performance.now(), value });
      }
      return answer;
    };
  });
  const page = await context.newPage();
  const pendingAssets = [];
  page.on('pageerror', (error) =>
    result.errors.push({ kind: 'pageerror', message: error.message })
  );
  page.on('requestfailed', (request) =>
    result.errors.push({ kind: 'requestfailed', url: request.url(), failure: request.failure() })
  );
  page.on('response', (response) => {
    if (!['script', 'stylesheet'].includes(response.request().resourceType())) return;
    pendingAssets.push(
      (async () => {
        const assetUrl = new URL(response.url());
        assert.equal(assetUrl.origin, new URL(url).origin);
        const relative = decodeURIComponent(assetUrl.pathname).replace(/^\//, '');
        const filename = path.resolve(project, 'dist', relative);
        assert.ok(filename.startsWith(path.resolve(project, 'dist') + path.sep));
        assert.equal(response.status(), 200);
        const disk = hash(fs.readFileSync(filename));
        const served = hash(await response.body());
        assert.equal(served, disk);
        result.assets.push({
          path: relative,
          status: response.status(),
          diskSha256: disk,
          servedSha256: served,
        });
      })().catch((error) => result.errors.push({ kind: 'asset-binding', message: error.message }))
    );
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const initialResponse = await page.goto(url, { waitUntil: 'load' });
  assert.equal(initialResponse.status(), 200);
  assert.equal(
    hash(await initialResponse.body()),
    hash(fs.readFileSync(path.join(project, 'dist/index.html')))
  );
  const input = page.getByRole('textbox', { name: 'Display name', exact: true });
  const action = page.locator(selectors.action);
  const checkbox = page.getByRole('checkbox');
  const writes = () => page.evaluate(() => window.__preferenceWrites);
  async function saved(name) {
    await page.waitForFunction(
      ({ expected, selector }) => {
        const stored = JSON.parse(localStorage.getItem('consumer-study-preferences') || '{}');
        return (
          stored.displayName === expected &&
          document.querySelector(selector)?.textContent === expected
        );
      },
      { expected: name, selector: selectors.savedName }
    );
    assert.equal(await action.getAttribute('aria-disabled'), 'false');
  }
  async function checkpoint(id, details = {}) {
    const state = await action.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        name: element.textContent,
        role: element.getAttribute('role'),
        disabled: element.getAttribute('aria-disabled'),
        focused: document.activeElement === element,
        background: style.backgroundColor,
        color: style.color,
        opacity: style.opacity,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        geometry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
    const screenshot = `${String(result.checkpoints.length + 1).padStart(2, '0')}-${id}.png`;
    await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
    write(screenshot.replace('.png', '.aria.yml'), await page.locator('body').ariaSnapshot());
    result.checkpoints.push({
      id,
      at: new Date().toISOString(),
      ...state,
      writes: await writes(),
      screenshot,
      ...details,
    });
    return state;
  }
  await checkpoint('initial');
  await input.fill('Pointer preference');
  const box = await action.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.getAttribute('aria-disabled') === 'true',
    selectors.action
  );
  assert.equal(await page.locator(selectors.busy).getAttribute('aria-busy'), 'true');
  const pending = await checkpoint('pending-disabled');
  assert.equal(pending.disabled, 'true');
  // Send a second physical pointer gesture immediately, without an enabled wait.
  const duplicateAt = await page.evaluate(() => performance.now());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await saved('Pointer preference');
  assert.equal((await writes()).length, 1, 'Duplicate activation submitted twice');
  await checkpoint('pointer-and-duplicate', { duplicateAtMs: duplicateAt });
  await input.fill('Enter preference');
  await input.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focus = await checkpoint('keyboard-focus');
  assert.equal(focus.focused, true);
  assert.ok(
    focus.outlineStyle !== 'none' && Number.parseFloat(focus.outlineWidth) > 0,
    'Visible focus outline absent'
  );
  await page.keyboard.press('Enter');
  await saved('Enter preference');
  assert.equal((await writes()).length, 2);
  await checkpoint('enter-save');
  await input.fill('Space preference');
  await input.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await saved('Space preference');
  assert.equal((await writes()).length, 3, 'Space did not produce exactly one save');
  await checkpoint('space-save');
  await input.fill('Recovered preference');
  await checkbox.check();
  await action.click();
  await page.getByRole('alert').waitFor({ state: 'visible' });
  assert.match(await page.getByRole('alert').textContent(), /Injected storage error/);
  assert.equal(await page.locator(selectors.savedName).textContent(), 'Space preference');
  assert.equal(await action.getAttribute('aria-disabled'), 'false');
  assert.equal((await writes()).length, 3);
  await checkpoint('error-and-reenable');
  await checkbox.uncheck();
  await action.click();
  await saved('Recovered preference');
  assert.equal((await writes()).length, 4);
  assert.equal(await page.getByRole('alert').count(), 0);
  await checkpoint('successful-retry');
  result.writesBeforeReload = await writes();
  await page.reload({ waitUntil: 'load' });
  assert.equal(await input.inputValue(), 'Recovered preference');
  assert.equal(await page.locator(selectors.savedName).textContent(), 'Recovered preference');
  await checkpoint('persisted-after-reload');
  await Promise.all(pendingAssets);
  assert.ok(result.assets.some((asset) => asset.path.endsWith('.js')));
  assert.deepEqual(result.errors, []);
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (context) await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  result.finishedAt = new Date().toISOString();
  write('result.json', JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
