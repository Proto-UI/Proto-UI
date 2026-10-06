// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page, Locator } from 'playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
  ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'dialog-available-space')
  : undefined;
const observations: unknown[] = [];
let browser: Browser, baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/en/ui-libraries/shadcn/dialog/');
  browser = await launchBrowser();
  if (output) await mkdir(output, { recursive: true });
}, 240_000);
afterAll(async () => {
  if (output)
    await writeFile(
      path.join(output, 'observations.json'),
      JSON.stringify(
        {
          sourceSha,
          browser: browser?.version(),
          conditions:
            'Real public Dialog. Viewport resizing and CDP page scale emulate available-space changes; not physical keyboard/notch evidence. Long text and 200% root font are explicit stress fixtures.',
          observations,
        },
        null,
        2
      )
    );
  await browser?.close();
  await stopServer();
}, 60_000);
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function facts(dialog: Locator) {
  return dialog.evaluate((e) => {
    const r = e.getBoundingClientRect(),
      s = getComputedStyle(e);
    const mask = Array.from(document.body.children).find(
      (n) =>
        n !== e &&
        n.hasAttribute('data-is-present') &&
        n.hasAttribute('data-pui-root') &&
        n.getAttribute('role') !== 'dialog'
    );
    const m = mask?.getBoundingClientRect();
    const v = visualViewport;
    return {
      rect: r.toJSON(),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        x: v?.offsetLeft ?? 0,
        y: v?.offsetTop ?? 0,
        visibleWidth: v?.width ?? innerWidth,
        visibleHeight: v?.height ?? innerHeight,
        scale: v?.scale ?? 1,
      },
      mask: m?.toJSON(),
      font: parseFloat(getComputedStyle(document.documentElement).fontSize),
      overflowY: s.overflowY,
      scrollHeight: e.scrollHeight,
      clientHeight: e.clientHeight,
      scrollTop: e.scrollTop,
      focusInside: e.contains(document.activeElement),
      active: document.activeElement?.outerHTML.slice(0, 300),
      transition: e.getAttribute('data-transition-state'),
      available: {
        width: s.getPropertyValue('--proto-ui-available-region-width'),
        height: s.getPropertyValue('--proto-ui-available-region-height'),
      },
    };
  });
}
async function capture(page: Page, dialog: Locator, id: string) {
  const data = await facts(dialog);
  let image;
  if (output) {
    const bytes = await page.screenshot({ path: path.join(output, `${id}.png`) });
    image = { file: `${id}.png`, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  observations.push({ id, sourceSha, viewport: page.viewportSize(), data, image });
  return data;
}
async function settle(dialog: Locator) {
  await expect
    .poll(() => dialog.getAttribute('data-transition-state'), { timeout: 20_000 })
    .toBe('entered');
  await dialog.evaluate(async (e) => {
    await Promise.all(e.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
  });
}
function bounded(data: Awaited<ReturnType<typeof facts>>) {
  const r = data.rect,
    v = data.viewport,
    g = data.font;
  expect(r.x - v.x).toBeGreaterThanOrEqual(g - 1);
  expect(v.x + v.visibleWidth - r.right).toBeGreaterThanOrEqual(g - 1);
  expect(r.y - v.y).toBeGreaterThanOrEqual(g - 1);
  expect(v.y + v.visibleHeight - r.bottom).toBeGreaterThanOrEqual(g - 1);
  expect(Math.abs(r.x + r.width / 2 - v.x - v.visibleWidth / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.y + r.height / 2 - v.y - v.visibleHeight / 2)).toBeLessThanOrEqual(1);
  expect(data.available.width).not.toBe('');
}
for (const family of ['shadcn', 'brutalist'] as const)
  for (const runtime of RUNTIMES) {
    it(`${family}/${runtime}: live available region bounds content, leaves Mask full-size, scrolls long text and restores on close`, async () => {
      const route =
        family === 'shadcn'
          ? '/en/ui-libraries/shadcn/dialog/'
          : '/en/ui-libraries/brutalist/components/dialog/';
      const { context, page, previewer } = await openRoute(browser, baseUrl, route, {
        width: 390,
        height: 900,
      });
      try {
        await selectRuntime(page, previewer, runtime, '[aria-haspopup="dialog"]', 1);
        const trigger = page.locator('[data-previewer-id] [aria-haspopup="dialog"]').first();
        await trigger.click();
        const dialog = page.getByRole('dialog').last();
        await dialog.waitFor({ state: 'visible' });
        await capture(page, dialog, `${family}-${runtime}-390-immediate`);
        await settle(dialog);
        await frames(page);
        const identity = await dialog.elementHandle();
        for (const width of [390, 430, 320, 1024]) {
          await page.setViewportSize({ width, height: 900 });
          await frames(page);
          const data = await capture(page, dialog, `${family}-${runtime}-${width}-settled`);
          bounded(data);
          expect(data.mask?.x).toBe(0);
          expect(data.mask?.y).toBe(0);
          expect(data.mask?.width).toBe(width);
          expect(data.mask?.height).toBe(900);
          expect(await identity?.evaluate((e) => e.isConnected)).toBe(true);
        }
        await page.setViewportSize({ width: 390, height: 360 });
        // Test-only content fixture, no geometry/style/measurement override on the component.
        await dialog.evaluate((e) => {
          const paragraph = document.createElement('p');
          paragraph.dataset.dialogLongFixture = '';
          paragraph.textContent =
            'Long content remains readable and every action remains reachable. '.repeat(100);
          e.append(paragraph);
        });
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
        await frames(page);
        const long = await capture(page, dialog, `${family}-${runtime}-long-font200`);
        bounded(long);
        expect(long.overflowY).toBe('auto');
        expect(long.scrollHeight).toBeGreaterThan(long.clientHeight);
        await dialog.evaluate((e) => {
          e.scrollTop = e.scrollHeight;
        });
        await frames(page);
        expect((await facts(dialog)).scrollTop).toBeGreaterThan(0);
        const longClose = dialog.locator('[data-pui-a11y-actions="activate"]').first();
        await longClose.scrollIntoViewIfNeeded();
        expect(
          await longClose.evaluate((e) => {
            const r = e.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return r.width > 0 && r.height > 0 && !!hit && e.contains(hit);
          })
        ).toBe(true);
        await capture(page, dialog, `${family}-${runtime}-long-action-reachable`);
        await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
        await dialog.locator('[data-dialog-long-fixture]').evaluate((e) => e.remove());
        await page.setViewportSize({ width: 430, height: 900 });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
        await frames(page);
        bounded(await capture(page, dialog, `${family}-${runtime}-scale2`));
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
        await cdp.detach();
        await frames(page);
        bounded(await capture(page, dialog, `${family}-${runtime}-restored`));
        const close = dialog.locator('[data-pui-a11y-actions="activate"]').first();
        await close.scrollIntoViewIfNeeded();
        await close.click();
        await dialog.waitFor({ state: 'hidden' });
        await expect.poll(() => page.locator('[data-pui-available-space-probe]').count()).toBe(0);
        expect(
          await identity?.evaluate((e) =>
            (e as HTMLElement).style.getPropertyValue('--proto-ui-available-region-width')
          )
        ).toBe('');
        await trigger.click();
        await dialog.waitFor({ state: 'visible' });
        await settle(dialog);
        await frames(page);
        bounded(await capture(page, dialog, `${family}-${runtime}-reopened`));
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
      } finally {
        await context.close();
      }
    }, 150_000);
  }
