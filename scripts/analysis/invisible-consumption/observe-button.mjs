// Operator-only native preflight of the actual production output. This is not a
// participant task, onboarding study, Adapter differential or visual-family claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness.ts';
import { json, readJson, safeFile, sha256, writeNew } from '../../benchmark/evidence.mjs';

const [, , evidenceDirectory, requestedUrl] = process.argv;
if (!evidenceDirectory || !requestedUrl || process.argv.length !== 4) throw new Error('Usage: node --import tsx observe-button.mjs <producer-root> <production-preview-url>');
const root = fs.realpathSync(evidenceDirectory);
const origin = new URL(requestedUrl);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use the owned local production preview');
assert.equal(origin.protocol, 'http:');
const preflight = readJson(safeFile(root, 'clean-consumer.json'));
const dist = safeFile(root, 'clean-consumer/dist');
for (const file of preflight.shippedFiles) assert.equal(sha256(fs.readFileSync(safeFile(root, file.path))), file.sha256, `Production preimage changed: ${file.path}`);
fs.mkdirSync(safeFile(root, 'operator/browser'), { recursive: false });
const observations = {
  schemaVersion: 1, evidenceClass: 'operator-preflight', consumerStudy: false,
  status: 'running', url: origin.href, productionFiles: preflight.shippedFiles,
  browser: null, assets: [], checkpoints: [], errors: [],
  omissions: ['No unaware consumer', 'No task-time/knowledge measurement', 'No styled-family/AT/parity or whole-library claim'],
};
const save = () => writeNew(root, 'operator/browser/result.json', json(observations));
const browser = await launchBrowser();
try {
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const requests = [];
page.on('pageerror', (error) => observations.errors.push({ kind: 'pageerror', message: error.message }));
page.on('requestfailed', (request) => observations.errors.push({ kind: 'requestfailed', url: request.url(), failure: request.failure() }));
page.on('response', (response) => {
  if (!['script', 'stylesheet'].includes(response.request().resourceType())) return;
  requests.push((async () => {
    const url = new URL(response.url());
    assert.equal(url.origin, origin.origin, 'Production asset escaped the selected consumer');
    assert.equal(response.status(), 200, 'Production asset did not load');
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
    const body = await response.body();
    assert.equal(sha256(body), sha256(fs.readFileSync(safeFile(dist, relative))), `Served production asset differs: ${relative}`);
    observations.assets.push({ url: url.href, path: relative, sha256: sha256(body) });
  })().catch((error) => {
    observations.errors.push({ kind: 'asset-binding', message: error instanceof Error ? error.message : String(error) });
  }));
});
async function navigate() {
  const response = await page.goto(origin.href, { waitUntil: 'load' });
  assert.ok(response && response.status() === 200);
  assert.equal(sha256(await response.body()), sha256(fs.readFileSync(safeFile(dist, 'index.html'))), 'Served index differs from the production build');
  await page.getByRole('button', { name: 'Save preference', exact: true }).waitFor({ state: 'visible' });
}
async function count(expected) {
  await page.waitForFunction((value) => document.querySelector('output[aria-label="Activations"]')?.textContent === String(value), expected);
}
async function checkpoint(name) {
  const action = page.getByRole('button', { name: 'Save preference', exact: true });
  const observed = await action.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { tag: element.tagName, text: element.textContent, role: element.getAttribute('role'), disabled: element.getAttribute('aria-disabled'), tabIndex: element.tabIndex, focused: element === document.activeElement, bounds: { x: box.x, y: box.y, width: box.width, height: box.height }, display: style.display, color: style.color, background: style.backgroundColor, outline: style.outline, opacity: style.opacity, hitWithin: target !== null && (target === element || element.contains(target)), activations: document.querySelector('output')?.textContent };
  });
  assert.ok(observed.bounds.width > 0 && observed.bounds.height > 0, 'Action has no native geometry');
  writeNew(root, `operator/browser/${name}.png`, await page.screenshot({ fullPage: true }));
  observations.checkpoints.push({ name, ...observed, screenshot: `operator/browser/${name}.png` });
  return observed;
}
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
try {
  observations.browser = browser.version();
  await navigate();
  await count(0);
  const initial = await checkpoint('01-enabled');
  assert.ok(initial.hitWithin, 'Enabled action is not the native hit target');
  await page.getByRole('button', { name: 'Save preference', exact: true }).click();
  await count(1);
  await checkpoint('02-pointer-activated');
  await navigate();
  await page.keyboard.press('Tab');
  const focused = await checkpoint('03-keyboard-focus');
  assert.equal(focused.focused, true, 'Tab did not reach the generated action');
  await page.keyboard.press('Enter');
  await count(1);
  await checkpoint('04-enter-activated');
  await page.keyboard.down('Space');
  await count(1);
  await checkpoint('05-space-held');
  await page.keyboard.up('Space');
  await count(2);
  await checkpoint('06-space-released');
  await page.getByRole('checkbox', { name: 'Disable action', exact: true }).check();
  const disabled = await checkpoint('07-disabled');
  assert.equal(disabled.disabled, 'true', 'Controlled disabled value is not visible to the accessibility surface');
  // Forced actionability still sends a real native pointer sequence. It is an
  // explicitly attempted disabled activation, not a claim that disabled is clickable.
  await page.getByRole('button', { name: 'Save preference', exact: true }).click({ force: true });
  observations.disabledObservation = await page.evaluate(async () => {
    const output = document.querySelector('output');
    const startedAt = performance.now();
    const samples = [{ atMs: 0, value: output?.textContent }];
    const observer = new MutationObserver(() => samples.push({ atMs: performance.now() - startedAt, value: output?.textContent }));
    observer.observe(output, { childList: true, subtree: true, characterData: true });
    const { promise, resolve } = Promise.withResolvers();
    setTimeout(resolve, 250);
    await promise;
    observer.disconnect();
    samples.push({ atMs: performance.now() - startedAt, value: output?.textContent });
    return { scope: 'Finite 250ms post-input observation, not indefinite absence', samples };
  });
  assert.ok(observations.disabledObservation.samples.every((sample) => sample.value === '2'), 'Disabled activation changed the observed outward count');
  await checkpoint('08-disabled-pointer-attempt');
  await page.getByRole('checkbox', { name: 'Disable action', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save preference', exact: true }).click();
  await count(3);
  await checkpoint('09-enabled-again');
  await Promise.all(requests);
  assert.ok(observations.assets.some((asset) => asset.path.endsWith('.js')), 'No production JavaScript response was bound to disk');
  assert.deepEqual(observations.errors, [], 'Native preflight reported runtime/network failures');
  observations.status = 'passed-operator-preflight';
} catch (error) {
  observations.status = 'failed-operator-preflight';
  observations.failure = error instanceof Error ? { message: error.message, stack: error.stack } : { thrown: String(error) };
  throw error;
} finally {
  save();
  await context.tracing.stop({ path: safeFile(root, 'operator/browser/trace.zip') });
}
} finally {
  await browser.close();
}
