// @vitest-environment node

import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, openRoute, startServer, stopServer } from './browser-harness';

const ROUTE = '/en/ui-libraries/shadcn/dialog/';

type PointerSample = { trusted: boolean; partial: boolean };
type PointerSampleWindow = Window & { __nextPointerSample?: Promise<PointerSample> };

let browser: Browser;
let baseUrl = '';

describe('Shadcn Dialog partial view remount', () => {
  beforeAll(async () => {
    baseUrl = await startServer(ROUTE);
    browser = await launchBrowser();
  }, 240_000);

  afterAll(async () => {
    await browser?.close();
    await stopServer();
  });

  it('keeps native mask dismissal after reopening between the two part detachments', async () => {
    const { context, page } = await openRoute(browser, baseUrl, ROUTE, {
      width: 1100,
      height: 900,
    });
    try {
      const trigger = page.locator('[data-previewer-id] [aria-haspopup="dialog"]').first();
      await trigger.waitFor();
      await trigger.evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -160);
      });
      const box = await trigger.boundingBox();
      if (!box) throw new Error('Dialog trigger has no rendered box.');
      const point = { x: box.x + Math.min(15, box.width / 2), y: box.y + box.height / 2 };

      let hitPartialWindow = false;
      for (let attempt = 0; attempt < 5 && !hitPartialWindow; attempt++) {
        await page.mouse.click(point.x, point.y);
        await page.waitForFunction(
          () =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.getAttribute('data-transition-state') === 'entered'
        );
        expect(await page.evaluate(() => document.elementFromPoint(5, 5)?.tagName)).toBe(
          'WC-SHADCN-DIALOG-MASK'
        );
        await page.mouse.click(5, 5);

        // The normal 150ms/200ms leave clocks stay intact. A missed window is
        // not evidence of repair: observe the actual next native pointer sample.
        try {
          await page.waitForFunction(
            () => {
              const mask = document.querySelector('wc-shadcn-dialog-mask');
              const content = document.querySelector('wc-shadcn-dialog-content');
              return (
                mask?.hasAttribute('data-pui-view-detached') &&
                content &&
                !content.hasAttribute('data-pui-view-detached')
              );
            },
            undefined,
            { polling: 1, timeout: 1000 }
          );
        } catch {
          await page.waitForFunction(() =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.hasAttribute('data-pui-view-detached')
          );
          continue;
        }
        // Install the observer before the click, not alongside it. Sent together,
        // the click could reach the page first; a `once` listener installed
        // after it would then wait for a pointer sample that never comes.
        await page.evaluate(() => {
          (window as PointerSampleWindow).__nextPointerSample = new Promise((resolve) => {
            document.addEventListener(
              'pointerdown',
              (event) => {
                const mask = document.querySelector('wc-shadcn-dialog-mask');
                const content = document.querySelector('wc-shadcn-dialog-content');
                resolve({
                  trusted: event.isTrusted,
                  partial: Boolean(
                    mask?.hasAttribute('data-pui-view-detached') &&
                    content &&
                    !content.hasAttribute('data-pui-view-detached') &&
                    content.getAttribute('data-transition-state') === 'leaving'
                  ),
                });
              },
              { once: true, capture: true }
            );
          });
        });
        await page.mouse.click(point.x, point.y);
        const sample = await page.evaluate(
          () => (window as PointerSampleWindow).__nextPointerSample!
        );
        expect(sample.trusted).toBe(true);
        hitPartialWindow = sample.partial;
        await page.waitForFunction(
          () =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.getAttribute('data-transition-state') === 'entered'
        );
        if (!hitPartialWindow) {
          await page.keyboard.press('Escape');
          await page.waitForFunction(() =>
            document
              .querySelector('wc-shadcn-dialog-content')
              ?.hasAttribute('data-pui-view-detached')
          );
        }
      }
      expect(
        hitPartialWindow,
        'a full-detach reopen is not the reported partial-remount scenario'
      ).toBe(true);
      expect(await page.evaluate(() => document.elementFromPoint(5, 5)?.tagName)).toBe(
        'WC-SHADCN-DIALOG-MASK'
      );
      await page.mouse.click(5, 5);
      await page.waitForFunction(
        () =>
          document
            .querySelector('wc-shadcn-dialog-content')
            ?.hasAttribute('data-pui-view-detached'),
        undefined,
        { timeout: 2000 }
      );
      expect(await page.locator('wc-shadcn-dialog-content').getAttribute('data-open')).toBeNull();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () =>
          document
            .querySelector('wc-shadcn-dialog-content')
            ?.getAttribute('data-transition-state') === 'entered'
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() =>
        document.querySelector('wc-shadcn-dialog-content')?.hasAttribute('data-pui-view-detached')
      );
    } finally {
      await context.close();
    }
  }, 120_000);
});
