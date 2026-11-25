// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type * as Fixture from './toast-pointer-native-consumer';

declare global {
  interface Window {
    ToastPointerFixture: typeof Fixture;
  }
}

let browser: Awaited<ReturnType<typeof launchBrowser>>;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./toast-pointer-native-consumer.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'ToastPointerFixture',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  bundle = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 60_000);
afterAll(async () => browser?.close());

async function openFixture(touch = false) {
  const context = await browser.newContext({
    viewport: { width: 480, height: 640 },
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(3_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setContent(`<!doctype html>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { margin: 0; padding: 24px; font: 16px/1.4 system-ui; }
      #scrollport { width: 360px; height: 260px; overflow: auto; }
      #toast { display: block; box-sizing: border-box; width: 340px; height: 180px;
        padding: 16px; border: 1px solid; background: white; }
      #undo, #dismiss { display: inline-block; padding: 10px 16px; margin-right: 8px;
        border: 1px solid; cursor: pointer; }
      #spacer { height: 800px; }
    </style>
    <div id="fixture-origin"><section id="scrollport"><div id="spacer"></div></section></div>`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => window.ToastPointerFixture.mount());
  return { context, page, errors };
}

describe('Toast native pointer arbitration', () => {
  it.each(['mouse', 'touch'] as const)(
    'preserves trusted %s activation of nested Action and Close',
    async (input) => {
      const { context, page, errors } = await openFixture(input === 'touch');
      try {
        const action = page.getByRole('button', { name: 'Undo', exact: true });
        const close = page.getByRole('button', { name: 'Dismiss', exact: true });
        if (input === 'touch') await action.tap();
        else await action.click();
        await page.waitForFunction(() => window.ToastPointerFixture.snapshot().actionCount === 1);
        const acted = await page.evaluate(() => window.ToastPointerFixture.snapshot());
        expect(acted).toMatchObject({
          open: true,
          actionCount: 1,
          openChanges: [],
          nativeClicks: [{ target: 'undo', trusted: true }],
          touchAction: 'pan-y',
        });
        if (input === 'mouse') expect(acted.focused).toBe('undo');

        if (input === 'touch') await close.tap();
        else await close.click();
        await page.waitForFunction(() => !window.ToastPointerFixture.snapshot().open);
        expect(await page.evaluate(() => window.ToastPointerFixture.snapshot())).toMatchObject({
          open: false,
          actionCount: 1,
          openChanges: [{ open: false, reason: 'close' }],
          nativeClicks: [
            { target: 'undo', trusted: true },
            { target: 'dismiss', trusted: true },
          ],
        });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  );

  it('dismisses only after a native drag crosses the configured threshold', async () => {
    const { context, page, errors } = await openFixture();
    try {
      const box = await page.locator('#toast').boundingBox();
      if (!box) throw new Error('The Toast root must have a native input box.');
      const drag = async (dx: number) => {
        const x = box.x + 100;
        const y = box.y + box.height - 24;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y, { steps: 8 });
        await page.mouse.up();
      };
      await drag(-120);
      await drag(40);
      expect(await page.evaluate(() => window.ToastPointerFixture.snapshot())).toMatchObject({
        open: true,
        openChanges: [],
        actionCount: 0,
      });
      await drag(140);
      await page.waitForFunction(() => !window.ToastPointerFixture.snapshot().open);
      expect(await page.evaluate(() => window.ToastPointerFixture.snapshot())).toMatchObject({
        openChanges: [{ open: false, reason: 'swipe' }],
        actionCount: 0,
        nativeClicks: [],
      });

      await page.evaluate(() => window.ToastPointerFixture.reopen());
      await page.evaluate(() => window.ToastPointerFixture.direction('none'));
      await drag(140);
      expect((await page.evaluate(() => window.ToastPointerFixture.snapshot())).open).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it('yields an orthogonal native touch drag to the scrolling container', async () => {
    const { context, page, errors } = await openFixture(true);
    try {
      const scrolling = await page.evaluate(() => {
        const viewport = document.querySelector('#viewport')!;
        const scrollport = document.querySelector('#scrollport')!;
        const toast = document.querySelector('#toast')!;
        return {
          viewportPortaledToBody: viewport.parentElement === document.body,
          scrollportInsideViewport: scrollport.parentElement === viewport,
          toastInsideScrollport: toast.parentElement === scrollport,
          spacerInsideScrollport: document.querySelector('#spacer')!.parentElement === scrollport,
          overflowY: getComputedStyle(scrollport).overflowY,
          touchAction: getComputedStyle(toast).touchAction,
          scrollTop: scrollport.scrollTop,
          clientHeight: scrollport.clientHeight,
          scrollHeight: scrollport.scrollHeight,
        };
      });
      expect(scrolling).toMatchObject({
        viewportPortaledToBody: true,
        scrollportInsideViewport: true,
        toastInsideScrollport: true,
        spacerInsideScrollport: true,
        overflowY: 'auto',
        touchAction: 'pan-y',
        scrollTop: 0,
      });
      expect(scrolling.clientHeight).toBeGreaterThan(0);
      expect(scrolling.scrollHeight - scrolling.clientHeight).toBeGreaterThan(20);
      const box = await page.locator('#toast').boundingBox();
      if (!box) throw new Error('The Toast root must have a native input box.');
      const session = await context.newCDPSession(page);
      const x = box.x + box.width - 24;
      const y = box.y + box.height - 16;
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - step * 18 }],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => window.ToastPointerFixture.snapshot().scrollTop > 20);
      expect(await page.evaluate(() => window.ToastPointerFixture.snapshot())).toMatchObject({
        open: true,
        openChanges: [],
        actionCount: 0,
        nativeClicks: [],
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
