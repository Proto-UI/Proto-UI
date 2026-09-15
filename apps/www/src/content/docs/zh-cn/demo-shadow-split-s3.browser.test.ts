// @vitest-environment node
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { runS3Journey } from '../../../../../../scripts/analysis/shadow-s3-journey.mjs';

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

describe.sequential('S3 complete Tabs and settings native acceptance paths', () => {
  for (const locale of ['zh-cn', 'en'])
    for (const keepMounted of [false, true])
      it(`${locale}: Light/split/mixed with keepMounted=${keepMounted}`, async () => {
        const context = await browser.newContext({
          colorScheme: 'light',
          viewport: { width: 1440, height: 1000 },
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
          await page.goto(`${baseUrl}/${locale}/internal/demo-matrix/#shadow-split-s3`);
          // Match the matrix smoke's real readiness boundary: independent
          // framework demos finish mounting after the S3 section is ready.
          await page.waitForFunction(
            () => {
              const previews = [...document.querySelectorAll('[data-previewer-id]')];
              return (
                previews.length > 0 &&
                previews.every(
                  (preview) =>
                    preview.getAttribute('data-inited') === '1' &&
                    (preview.querySelector('.host')?.childElementCount ?? 0) > 0
                )
              );
            },
            undefined,
            { timeout: 60_000 }
          );
          page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame())
              errors.push(`Unexpected navigation during S3: ${frame.url()}`);
          });
          await runS3Journey(page, { keepMounted });
          await page.setViewportSize({ width: 320, height: 900 });
          await page.waitForTimeout(300);
          expect(
            await page.locator('[data-shadow-s3]').evaluate((el) => el.scrollWidth > el.clientWidth)
          ).toBe(false);
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }, 150_000);
});
