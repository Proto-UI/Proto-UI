// Shared black-box observation for frozen deterministic/generative Button outputs.
// The common subset permits native disabled semantics and either Space activation edge.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness.ts';
import { json, readJson, safeFile, sha256, writeNew } from '../../benchmark/evidence.mjs';
import { bindProductionAsset } from '../invisible-consumption/asset-binding.mjs';

const [, , evidenceDirectory, requestedUrl] = process.argv;
if (!evidenceDirectory || !requestedUrl || process.argv.length !== 4)
  throw new Error(
    'Usage: node --import tsx observe-button.mjs <producer-root> <production-preview-url>'
  );
const root = fs.realpathSync(evidenceDirectory);
const origin = new URL(requestedUrl);
assert.ok(
  ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname),
  'Use the owned local production preview'
);
assert.equal(origin.protocol, 'http:');
const preflight = readJson(safeFile(root, 'clean-consumer.json'));
const dist = safeFile(root, 'clean-consumer/dist');
const frozenAssets = new Map(
  preflight.shippedFiles.map((file) => [
    file.path.replace(/^clean-consumer\/dist\//, ''),
    file.sha256,
  ])
);
for (const file of preflight.shippedFiles)
  assert.equal(
    sha256(fs.readFileSync(safeFile(root, file.path))),
    file.sha256,
    `Production preimage changed: ${file.path}`
  );
fs.mkdirSync(safeFile(root, 'operator/browser'), { recursive: false });
const observations = {
  schemaVersion: 1,
  evidenceClass: 'shared-button-comparison-observation',
  consumerStudy: false,
  status: 'running',
  url: origin.href,
  productionFiles: preflight.shippedFiles,
  browser: null,
  assets: [],
  checkpoints: [],
  errors: [],
  omissions: [
    'No native mixing, old retained callable, SSR, non-Web or full Button-surface claim',
    'No AT or physical-input claim',
    'Space activation edge is diagnostic when the complete gesture activates exactly once',
    'Exactly-once and disabled absence are observed for a finite 250ms after each gesture, not indefinitely',
  ],
};
const save = () => writeNew(root, 'operator/browser/result.json', json(observations));
const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 960, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const requests = [];
  const verifiedBodies = new Map();
  let assetChecks = Promise.resolve();
  page.on('pageerror', (error) =>
    observations.errors.push({ kind: 'pageerror', message: error.message })
  );
  page.on('requestfailed', (request) =>
    observations.errors.push({
      kind: 'requestfailed',
      url: request.url(),
      failure: request.failure(),
    })
  );
  page.on('response', (response) => {
    if (!['script', 'stylesheet'].includes(response.request().resourceType())) return;
    // Keep response order: a conditional revalidation can only refer to an
    // earlier complete 200 body that this same observer has already verified.
    assetChecks = assetChecks
      .then(async () => {
        const url = new URL(response.url());
        assert.equal(url.origin, origin.origin, 'Production asset escaped the selected consumer');
        const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
        const status = response.status();
        assert.ok(
          frozenAssets.has(relative),
          'Loaded asset is absent from the frozen production inventory'
        );
        assert.equal(
          sha256(fs.readFileSync(safeFile(dist, relative))),
          frozenAssets.get(relative),
          'Production asset changed since admission'
        );
        const record = bindProductionAsset(
          {
            url: url.href,
            origin: origin.origin,
            path: relative,
            status,
            diskSha256: frozenAssets.get(relative),
            bodySha256: status === 200 ? sha256(await response.body()) : undefined,
            etag: await response.headerValue('etag'),
            ifNoneMatch: await response.request().headerValue('if-none-match'),
          },
          verifiedBodies.get(url.href)
        );
        if (status === 200) verifiedBodies.set(url.href, record);
        observations.assets.push(record);
      })
      .catch((error) => {
        observations.errors.push({
          kind: 'asset-binding',
          message: error instanceof Error ? error.message : String(error),
        });
      });
    requests.push(assetChecks);
  });
  async function navigate() {
    const response = await page.goto(origin.href, { waitUntil: 'load' });
    assert.ok(response && response.status() === 200);
    assert.ok(
      frozenAssets.has('index.html'),
      'Index is absent from the frozen production inventory'
    );
    assert.equal(
      sha256(fs.readFileSync(safeFile(dist, 'index.html'))),
      frozenAssets.get('index.html'),
      'Production index changed since admission'
    );
    assert.equal(
      sha256(await response.body()),
      frozenAssets.get('index.html'),
      'Served index differs from the production build'
    );
    await page
      .getByRole('button', { name: 'Save preference', exact: true })
      .waitFor({ state: 'visible' });
  }
  async function count(expected) {
    await page.waitForFunction(
      (value) =>
        document.querySelector('output[aria-label="Activations"]')?.textContent === String(value),
      expected
    );
  }
  async function gesture(id, before, after, perform) {
    await page.evaluate((expected) => {
      const output = document.querySelector('output[aria-label="Activations"]');
      if (output?.textContent !== String(expected)) throw new Error('Gesture pre-count differs');
      const startedAt = performance.now();
      const samples = [{ atMs: 0, value: output.textContent }];
      const observer = new MutationObserver(() =>
        samples.push({ atMs: performance.now() - startedAt, value: output.textContent })
      );
      observer.observe(output, { childList: true, subtree: true, characterData: true });
      window.__buttonComparisonObservation = { output, startedAt, samples, observer };
    }, before);
    await perform();
    const observation = await page.evaluate(async () => {
      const trace = window.__buttonComparisonObservation;
      const gestureEndedAtMs = performance.now() - trace.startedAt;
      await new Promise((resolve) => setTimeout(resolve, 250));
      trace.samples.push({
        atMs: performance.now() - trace.startedAt,
        value: trace.output.textContent,
      });
      trace.observer.disconnect();
      delete window.__buttonComparisonObservation;
      return { gestureEndedAtMs, postGestureWindowMs: 250, samples: trace.samples };
    });
    (observations.gestures ??= []).push({ id, before, after, ...observation });
    const values = observation.samples.map((sample) => Number(sample.value));
    assert.ok(
      values.every((value) => Number.isInteger(value) && value >= before && value <= after),
      `${id}: count escaped allowed interval`
    );
    assert.ok(
      values.every((value, index) => index === 0 || value >= values[index - 1]),
      `${id}: count reversed during observation`
    );
    assert.equal(values.at(-1), after, `${id}: final count differs`);
  }
  async function checkpoint(name) {
    const action = page.getByRole('button', { name: 'Save preference', exact: true });
    const observed = await action.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        tag: element.tagName,
        text: element.textContent,
        role: element.getAttribute('role'),
        disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
        tabIndex: element.tabIndex,
        focused: element === document.activeElement,
        bounds: { x: box.x, y: box.y, width: box.width, height: box.height },
        display: style.display,
        color: style.color,
        background: style.backgroundColor,
        outline: style.outline,
        opacity: style.opacity,
        hitWithin: target !== null && (target === element || element.contains(target)),
        activations: document.querySelector('output')?.textContent,
      };
    });
    assert.ok(
      observed.bounds.width > 0 && observed.bounds.height > 0,
      'Action has no native geometry'
    );
    writeNew(root, `operator/browser/${name}.png`, await page.screenshot({ fullPage: true }));
    observations.checkpoints.push({
      name,
      ...observed,
      screenshot: `operator/browser/${name}.png`,
    });
    return observed;
  }
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  try {
    observations.browser = browser.version();
    await navigate();
    await count(0);
    const initial = await checkpoint('01-enabled');
    assert.ok(initial.hitWithin, 'Enabled action is not the native hit target');
    await gesture('pointer', 0, 1, () =>
      page.getByRole('button', { name: 'Save preference', exact: true }).click()
    );
    await checkpoint('02-pointer-activated');
    await navigate();
    await count(0);
    await checkpoint('03-fresh-document');
    await page.keyboard.press('Tab');
    const focused = await checkpoint('03-keyboard-focus');
    assert.equal(focused.focused, true, 'Tab did not reach the generated action');
    await gesture('enter', 0, 1, () => page.keyboard.press('Enter'));
    await checkpoint('04-enter-activated');
    await gesture('space', 1, 2, async () => {
      await page.keyboard.down('Space');
      // Either legal activation edge is diagnostic, not a route preference.
      const held = await checkpoint('05-space-held');
      assert.ok(
        ['1', '2'].includes(held.activations),
        'Space keydown produced an invalid activation count'
      );
      observations.spaceActivationEdge = held.activations === '2' ? 'keydown' : 'keyup-or-later';
      await page.keyboard.up('Space');
    });
    await checkpoint('06-space-released');
    await page.getByRole('checkbox', { name: 'Disable action', exact: true }).check();
    const disabled = await checkpoint('07-disabled');
    assert.equal(
      disabled.disabled,
      true,
      'Controlled disabled value is not visible to the accessibility surface'
    );
    // Forced actionability still sends a real native pointer sequence. It is an
    // explicitly attempted disabled activation, not a claim that disabled is clickable.
    await gesture('disabled-pointer', 2, 2, () =>
      page.getByRole('button', { name: 'Save preference', exact: true }).click({ force: true })
    );
    await checkpoint('08-disabled-pointer-attempt');
    const disabledAction = page.getByRole('button', { name: 'Save preference', exact: true });
    const disabledCanFocus = await disabledAction.evaluate((element) => {
      element.focus();
      return document.activeElement === element;
    });
    observations.disabledKeyboard = { focusable: disabledCanFocus, attempted: [] };
    if (disabledCanFocus) {
      for (const key of ['Enter', 'Space']) {
        await gesture(`disabled-${key.toLowerCase()}`, 2, 2, () => page.keyboard.press(key));
        observations.disabledKeyboard.attempted.push({
          key,
          activations: await page.locator('output[aria-label="Activations"]').textContent(),
        });
      }
    } else {
      observations.disabledKeyboard.semantics = await disabledAction.evaluate((element) => ({
        nativeDisabled: element.matches(':disabled'),
        ariaDisabled: element.getAttribute('aria-disabled') === 'true',
        tabIndex: element.tabIndex,
        focusRetained: document.activeElement === element,
      }));
      observations.disabledKeyboard.reason =
        'The disabled action rejected or retired focus. Keyboard events were not dispatched to it or counted as passed keyboard attempts.';
      assert.ok(
        observations.disabledKeyboard.semantics.nativeDisabled ||
          observations.disabledKeyboard.semantics.ariaDisabled
      );
      assert.equal(observations.disabledKeyboard.semantics.focusRetained, false);
    }
    await page.getByRole('checkbox', { name: 'Disable action', exact: true }).uncheck();
    await gesture('reenabled-pointer', 2, 3, () =>
      page.getByRole('button', { name: 'Save preference', exact: true }).click()
    );
    await checkpoint('09-enabled-again');
    await Promise.all(requests);
    assert.ok(
      observations.assets.some((asset) => asset.path.endsWith('.js')),
      'No production JavaScript response was bound to disk'
    );
    assert.deepEqual(observations.errors, [], 'Native preflight reported runtime/network failures');
    observations.status = 'passed-shared-button-observation';
  } catch (error) {
    observations.status = 'failed-shared-button-observation';
    observations.failure =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { thrown: String(error) };
    throw error;
  } finally {
    save();
    await context.tracing.stop({ path: safeFile(root, 'operator/browser/trace.zip') });
  }
} finally {
  await browser.close();
}
