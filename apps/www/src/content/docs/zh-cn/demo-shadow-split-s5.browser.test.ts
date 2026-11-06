// @vitest-environment node
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { matrixHostsReady } from './demo-matrix-observation';
import { runS5Journey } from '../../../../../../scripts/analysis/shadow-s5-journey.mjs';

let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/internal/demo-matrix/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
describe.sequential('S5 native editor acceptance paths', () => {
  for (const locale of ['zh-cn', 'en'])
    it(`${locale}: Light/split/mixed native editing`, async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.goto(`${baseUrl}/${locale}/internal/demo-matrix/#shadow-split-s5`);
        // Share the matrix smoke's committed-host boundary: preview failures
        // surface their own errors instead of an unexplained readiness timeout.
        await page.waitForFunction(matrixHostsReady, undefined, { timeout: 60_000 });
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) errors.push(`Unexpected navigation: ${frame.url()}`);
        });
        await runS5Journey(page);
        await page.setViewportSize({ width: 320, height: 900 });
        await page.waitForTimeout(250);
        expect(
          await page.locator('[data-shadow-s5]').evaluate((el) => el.scrollWidth > el.clientWidth)
        ).toBe(false);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }, 150_000);
});
