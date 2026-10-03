// @vitest-environment node

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/en/ui-libraries/base/table/';
const CHINESE_ROUTE = '/zh-cn/ui-libraries/base/table/';
const RUNTIMES = ['wc', 'react', 'vue', 'vue2'] as const;
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer([ROUTE, CHINESE_ROUTE]);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// T-TABLE-STRUCTURE-0001-CASE-A11Y-BOUNDARY
describe.sequential('Base Table public four-adapter browser evidence', () => {
  for (const runtime of RUNTIMES) {
    it(`${runtime} renders the same passive Table semantics and ordered header graph`, async () => {
      const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
        width: 1100,
        height: 820,
      });
      try {
        const viteErrors = await page.locator('vite-error-overlay').allTextContents();
        if (viteErrors.length > 0) throw new Error(`Vite overlay: ${viteErrors[0]}`);
        expect(await previewer.getAttribute('data-demo-id')).toBe('demo-base-table');
        await selectRuntime(page, previewer, runtime, '[role="table"]', 1);

        const table = previewer.locator('.host [role="table"]');
        const caption = previewer.locator('[data-demo-ref="caption"]');
        expect(await table.getAttribute('aria-labelledby')).toBe(await caption.getAttribute('id'));
        expect(await table.getAttribute('aria-rowcount')).toBe('3');
        expect(await table.getAttribute('aria-colcount')).toBe('3');

        const rows = previewer.locator('.host [role="row"]');
        expect(await rows.count()).toBe(3);
        expect(
          await rows.evaluateAll((items) => items.map((item) => item.getAttribute('aria-rowindex')))
        ).toEqual(['1', '2', '3']);
        expect(await previewer.getByRole('columnheader').allTextContents()).toEqual([
          'Team',
          'Q1',
          'Q2',
        ]);
        expect(await previewer.getByRole('rowheader').allTextContents()).toEqual([
          'Platform',
          'Support',
        ]);
        expect(await previewer.getByRole('cell').allTextContents()).toEqual([
          '99.94%',
          '99.97%',
          '4.8 / 5',
          '4.9 / 5',
        ]);

        const q1 = previewer.locator('[data-demo-ref="team-q1"]');
        const platform = previewer.locator('[data-demo-ref="platform"]');
        const value = previewer.locator('[data-demo-ref="platform-q1"]');
        const labelledBy = (await value.getAttribute('aria-labelledby'))?.split(/\s+/) ?? [];
        expect(labelledBy).toEqual([
          await q1.getAttribute('id'),
          await platform.getAttribute('id'),
          await value.getAttribute('id'),
        ]);
        expect(await table.getAttribute('aria-labelledby')).toBe(await caption.getAttribute('id'));

        const screenshotDir = process.env.PROTO_UI_TABLE_SCREENSHOT_DIR;
        if (screenshotDir) {
          await mkdir(screenshotDir, { recursive: true });
          await previewer.screenshot({
            path: path.join(screenshotDir, `${runtime}.png`),
            style: 'astro-dev-toolbar { visibility: hidden; }',
          });
        }
      } finally {
        await context.close();
      }
    }, 60_000);
  }

  it('keeps the Chinese page on the same four-adapter public demo', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, CHINESE_ROUTE, {
      width: 390,
      height: 900,
    });
    try {
      await selectRuntime(page, previewer, 'vue2', '[role="table"]', 1);
      expect(await previewer.getAttribute('data-demo-id')).toBe('demo-base-table');
      expect(await previewer.locator('.host [role="table"]').getAttribute('aria-labelledby')).toBe(
        await previewer.locator('[data-demo-ref="caption"]').getAttribute('id')
      );
    } finally {
      await context.close();
    }
  }, 60_000);
});
