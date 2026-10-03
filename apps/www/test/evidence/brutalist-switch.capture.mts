import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  launchBrowser,
  startServer,
  stopServer,
  selectRuntime,
  applyColorScheme,
  RUNTIMES,
} from '../../src/content/docs/zh-cn/browser-harness';

const output = process.env.PROTO_UI_SWITCH_EVIDENCE_DIR;
assert(output, 'PROTO_UI_SWITCH_EVIDENCE_DIR is required');
const baseline = process.env.PROTO_UI_SWITCH_BASELINE === '1';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const driverSha256 = createHash('sha256')
  .update(await readFile(new URL(import.meta.url)))
  .digest('hex');
const route = '/en/ui-libraries/brutalist/components/switch/';
const rootSelector = '[data-projection-content] [data-demo-ref="emailAlertsSwitch"]';
const readySelector = '[data-projection-content] [role="switch"]';
const readGeometry = (root: Element) => {
  const thumb = root.querySelector('[data-pui-root]')!;
  const r = root.getBoundingClientRect(),
    t = thumb.getBoundingClientRect();
  const rs = getComputedStyle(root),
    ts = getComputedStyle(thumb);
  return {
    root: { x: r.x, y: r.y, width: r.width, height: r.height },
    thumb: { x: t.x, y: t.y, width: t.width, height: t.height },
    insetLeft: t.left - r.left,
    insetRight: r.right - t.right,
    centerError: t.top + t.height / 2 - (r.top + r.height / 2),
    rootRadius: rs.borderRadius,
    thumbRadius: ts.borderRadius,
    rootShadow: rs.boxShadow,
    thumbShadow: ts.boxShadow,
    background: rs.backgroundColor,
    thumbBackground: ts.backgroundColor,
    fontFamily: rs.fontFamily,
    fontWeight: rs.fontWeight,
    transition: ts.transitionProperty,
    transitionDuration: ts.transitionDuration,
    transform: ts.transform,
    checked: root.getAttribute('aria-checked'),
    label: root.getAttribute('aria-label'),
    direction: rs.direction,
  };
};
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const records: unknown[] = [];
try {
  const baseUrl = await startServer(route);
  for (const viewport of [
    { width: 960, height: 720 },
    { width: 320, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'no-preference',
      ...(viewport.width === 960 ? { recordVideo: { dir: output, size: viewport } } : {}),
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
    const previewer = page.locator('[data-previewer-id]').first();
    for (const runtime of RUNTIMES) {
      await selectRuntime(page, previewer, runtime, readySelector, 3);
      for (const theme of ['light', 'dark'] as const) {
        await applyColorScheme(page, theme);
        await previewer.scrollIntoViewIfNeeded();
        const root = page.locator(rootSelector);
        await root.waitFor();
        if ((await root.getAttribute('aria-checked')) === 'true') await root.click();
        if (!baseline) await page.evaluate(() => document.fonts.load('500 14px "DM Sans"'));
        await page.waitForTimeout(200); // Deliberate settled endpoint, after 150ms reference transition.
        const loadedFonts = await page.evaluate(() =>
          Array.from(document.fonts).map((face) => ({
            family: face.family,
            status: face.status,
            weight: face.weight,
          }))
        );
        if (!baseline)
          assert(
            loadedFonts.some(
              (face) =>
                face.family.replace(/^["']|["']$/g, '') === 'DM Sans' && face.status === 'loaded'
            ),
            'DM Sans asset must actually load'
          );
        const off = await root.evaluate(readGeometry);
        await previewer.screenshot({
          path: path.join(output, `${viewport.width}-${runtime}-${theme}-off.png`),
        });
        // Record every animation frame while a real pointer click commits checked state.
        const framesPromise = root.evaluate(async (root) => {
          const frames: Array<{
            time: number;
            x: number;
            y: number;
            width: number;
            height: number;
            rootX: number;
            rootY: number;
            rootWidth: number;
            rootHeight: number;
          }> = [];
          const start = performance.now();
          while (performance.now() - start < 450) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const t = root.querySelector('[data-pui-root]')!.getBoundingClientRect(),
              r = root.getBoundingClientRect();
            frames.push({
              time: performance.now() - start,
              x: t.x,
              y: t.y,
              width: t.width,
              height: t.height,
              rootX: r.x,
              rootY: r.y,
              rootWidth: r.width,
              rootHeight: r.height,
            });
          }
          return frames;
        });
        await root.click();
        const frames = await framesPromise;
        const on = await root.evaluate(readGeometry);
        await previewer.screenshot({
          path: path.join(output, `${viewport.width}-${runtime}-${theme}-on.png`),
        });
        assert.equal(on.checked, 'true');
        assert.equal(off.checked, 'false');
        if (!baseline) {
          assert.equal(off.root.width, 48);
          assert.equal(off.root.height, 24);
          assert.equal(off.thumb.width, 16);
          assert.equal(off.thumb.height, 16);
          assert(Math.abs(off.insetLeft - 6) < 0.1);
          assert(Math.abs(on.insetRight - 6) < 0.1);
          assert(Math.abs(on.thumb.x - off.thumb.x - 20) < 0.1);
          assert(Math.abs(off.centerError) < 0.1);
          assert(Math.abs(on.centerError) < 0.1);
          assert.equal(off.thumbBackground, 'rgb(255, 255, 255)');
          assert.equal(on.thumbBackground, off.thumbBackground);
          assert(off.fontFamily.includes('DM Sans'));
          assert.equal(off.fontWeight, '500');
          assert.equal(off.transition, 'transform');
          for (const f of frames) {
            assert(Math.abs(f.y + f.height / 2 - (f.rootY + f.rootHeight / 2)) < 0.1);
            assert(f.x >= f.rootX + 5.9 && f.x + f.width <= f.rootX + f.rootWidth - 5.9);
          }
          assert(
            new Set(frames.map((f) => Math.round(f.x * 10))).size > 2,
            'Normal motion must contain intermediate frames'
          );
        }
        // Real keyboard activation, while the root retains its accessible switch identity.
        await root.focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        assert.equal(await root.getAttribute('aria-checked'), 'false');
        const disabled = page.locator(
          '[data-projection-content] [data-demo-ref="archivedAlertsSwitch"]'
        );
        assert.equal(await disabled.getAttribute('aria-disabled'), 'true');
        const disabledBefore = await disabled.getAttribute('aria-checked');
        const disabledBox = await disabled.boundingBox();
        assert(disabledBox);
        await page.mouse.click(
          disabledBox.x + disabledBox.width / 2,
          disabledBox.y + disabledBox.height / 2
        );
        assert.equal(await disabled.getAttribute('aria-checked'), disabledBefore);
        // A direction stress fixture changes only the ancestor's CSS direction; it does not set component states/styles.
        await previewer.evaluate((el) => el.setAttribute('dir', 'rtl'));
        const rtlOff = await root.evaluate(readGeometry);
        await root.click();
        await page.waitForTimeout(200);
        const rtlOn = await root.evaluate(readGeometry);
        if (!baseline) {
          assert(Math.abs(rtlOff.insetLeft - 6) < 0.1);
          assert(Math.abs(rtlOn.insetRight - 6) < 0.1);
          assert(Math.abs(rtlOn.centerError) < 0.1);
        }
        await previewer.evaluate((el) => el.removeAttribute('dir'));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await root.click();
        const reduced = await root.evaluate(readGeometry);
        if (!baseline) {
          assert.equal(reduced.transition, 'none');
          assert(Math.abs(reduced.insetLeft - 6) < 0.1);
        }
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        records.push({
          loadedFonts,
          runtime,
          theme,
          viewport,
          off,
          on,
          frames,
          rtlOff,
          rtlOn,
          reduced,
          errors: [...errors],
        });
      }
    }
    assert.deepEqual(errors, [], 'page exceptions');
    const video = page.video();
    await context.close();
    if (video) await video.saveAs(path.join(output, `${viewport.width}-switch-motion.webm`));
  }
} finally {
  await writeFile(
    path.join(output, 'measurements.json'),
    JSON.stringify(
      {
        sourceSha,
        dirty: !!dirty,
        changedFiles: dirty,
        driverSha256,
        route,
        baseline,
        records,
        browserVersion: browser.version(),
      },
      null,
      2
    )
  );
  await browser.close();
  await stopServer();
}
console.log(JSON.stringify({ sourceSha, dirty: !!dirty, records: records.length, output }));
