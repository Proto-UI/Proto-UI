// Product-free, fixed Playwright 1.58.2 native-focus diagnostic. Not executed yet.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
const packageInfo = JSON.parse(await readFile(require.resolve('playwright-core/package.json'), 'utf8'));
assert.equal(packageInfo.version, '1.58.2', 'do not silently change the approved driver');
const { chromium } = await import('playwright-core');
const executablePath = process.env.CHROME_PATH;
assert.ok(executablePath, 'supply the explicitly approved Chrome executable');
const headed = process.argv.includes('--headed');
if (headed) assert.ok(process.env.DISPLAY, 'headed control requires the approved isolated display');
const out = resolve(process.argv[2]);
await mkdir(out, { recursive: true });
const report = {
  scriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  driver: packageInfo.version, headed, browser: null,
  scope: 'Two own about:blank pages only; no Proto-UI code, credentials, app imports, mocked events or external resources.',
  originalBudget: { downWaitMs: 40, otherFrontWaitMs: 100, returnWaitMs: 400 },
  requestsDenied: [], cases: [],
};
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: !headed,
    args: ['--disable-dev-shm-usage', '--no-sandbox'] });
  report.browser = browser.version();
  for (const disableFocusEmulation of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    await context.route('**/*', (route) => {
      report.requestsDenied.push(route.request().url());
      return route.abort();
    });
    await context.addInitScript(() => {
      window.__nativeFocusEvents = [];
      for (const type of ['focus', 'blur', 'focusin', 'focusout', 'pointerdown', 'pointerup', 'click', 'visibilitychange']) {
        addEventListener(type, (event) => window.__nativeFocusEvents.push({
          type, trusted: event.isTrusted, windowTarget: event.target === window,
          target: event.target instanceof Element ? event.target.tagName : event.target === document ? 'document' : 'window',
          hasFocus: document.hasFocus(), visibility: document.visibilityState,
          at: performance.now(),
        }), true);
      }
    });
    const entry = { disableFocusEmulation, operations: [], snapshots: [], error: null, trustedWindowBlurBeforeUp: false };
    report.cases.push(entry);
    let first, other, firstCdp, otherCdp;
    const action = async (name, callback) => {
      entry.operations.push({ name, phase: 'start', at: performance.now() });
      const result = await callback();
      entry.operations.push({ name, phase: 'resolved', at: performance.now() });
      return result;
    };
    const snapshot = async (stage) => {
      const read = (page) => page.evaluate(() => ({ hasFocus: document.hasFocus(),
        visibility: document.visibilityState, active: document.activeElement?.tagName,
        events: window.__nativeFocusEvents }));
      const firstState = await read(first);
      entry.snapshots.push({ stage, first: firstState, other: other && !other.isClosed() ? await read(other) : null });
      return firstState;
    };
    try {
      first = await action('first.newPage', () => context.newPage());
      await first.goto('about:blank');
      await first.setContent('<!doctype html><button style="position:absolute;left:100px;top:100px;width:120px;height:60px">Owned native control</button>');
      firstCdp = await context.newCDPSession(first);
      if (disableFocusEmulation) await action('first.Emulation.setFocusEmulationEnabled(false)',
        () => firstCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }));
      await action('first.bringToFront', () => first.bringToFront());
      await first.mouse.move(140, 130);
      await snapshot('before-down');
      await action('first.mouse.down', () => first.mouse.down());
      await first.waitForTimeout(40);
      await snapshot('after-down-before-other');
      other = await action('other.newPage', () => context.newPage());
      await other.goto('about:blank');
      otherCdp = await context.newCDPSession(other);
      if (disableFocusEmulation) await action('other.Emulation.setFocusEmulationEnabled(false)',
        () => otherCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }));
      await action('other.bringToFront', () => other.bringToFront());
      await first.waitForTimeout(100);
      const beforeUp = await snapshot('other-front-before-up');
      const down = beforeUp.events.findLastIndex((event) => event.type === 'pointerdown');
      assert.ok(down >= 0 && beforeUp.events[down].trusted && beforeUp.events[down].target === 'BUTTON',
        'the native trigger needs a trusted button down, not an unrelated earlier blur');
      entry.trustedWindowBlurBeforeUp = beforeUp.events.slice(down + 1).some((event) =>
        event.type === 'blur' && event.trusted && event.windowTarget);
      await action('first.mouse.up', () => first.mouse.up());
      await snapshot('after-up-before-other-close');
      await action('other.close', () => other.close());
      await action('first.bringToFront-again', () => first.bringToFront());
      await first.waitForTimeout(400);
      await snapshot('returned');
    } catch (error) {
      entry.error = String(error?.stack ?? error);
    } finally {
      // Restore the pinned driver's original setting, even on failed assertions.
      if (disableFocusEmulation) {
        for (const [name, page, client] of [['first', first, firstCdp], ['other', other, otherCdp]]) {
          if (page && !page.isClosed() && client) {
            await action(`${name}.Emulation.setFocusEmulationEnabled(true)-restore`, () =>
              client.send('Emulation.setFocusEmulationEnabled', { enabled: true })).catch((error) => {
                entry.error ??= `restore: ${String(error)}`;
              });
          }
        }
      }
      await context.close();
      await writeFile(join(out, disableFocusEmulation ? 'real-focus.json' : 'driver-default.json'), JSON.stringify(entry, null, 2));
    }
  }
} finally {
  await browser?.close();
  await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2));
}
// This validates only whether the native trigger is achievable, not product cleanup.
process.exitCode = report.cases.length === 2 && report.cases.every((item) => !item.error)
  && report.cases[1].trustedWindowBlurBeforeUp ? 0 : 1;
