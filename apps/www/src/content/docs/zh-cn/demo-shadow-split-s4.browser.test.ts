// @vitest-environment node
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { runS4Journey } from '../../../../../../scripts/analysis/shadow-s4-journey.mjs';
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
describe.sequential('S4 complete public Dialog settings', () => {
  for (const locale of ['zh-cn', 'en'])
    it(`${locale}: native Light/split/mixed acceptance`, async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.goto(`${baseUrl}/${locale}/internal/demo-matrix/#shadow-split-s4`);
        await page.waitForFunction(
          () => {
            const previews = [...document.querySelectorAll('[data-previewer-id]')];
            return (
              previews.length > 0 &&
              previews.every(
                (p) =>
                  p.getAttribute('data-inited') === '1' &&
                  (p.querySelector('.host')?.childElementCount ?? 0) > 0
              )
            );
          },
          undefined,
          { timeout: 60_000 }
        );
        page.on('framenavigated', (f) => {
          if (f === page.mainFrame()) errors.push(`Unexpected navigation: ${f.url()}`);
        });
        await runS4Journey(page);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }, 150_000);
});
