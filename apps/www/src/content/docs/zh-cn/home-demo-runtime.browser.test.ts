// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, startServer, stopServer } from './browser-harness';

const HOME_ROUTE = '/zh-cn/';
const HOME_SELECTOR = '[data-home-demo-options]';

async function waitForHomeRuntime(page: Page, runtime: string): Promise<void> {
  await page.waitForFunction(
    ({ homeSelector, selectedRuntime }) => {
      const root = document.querySelector<HTMLElement>(homeSelector);
      const select = root?.querySelector<HTMLElement>('[data-home-demo-runtime]');
      const host = root?.querySelector<HTMLElement>('[data-home-demo-host]');
      return (
        select?.dataset.value === selectedRuntime &&
        (host?.querySelector('[data-pui-root]') != null ||
          host?.textContent?.includes('[Home Demo Error]') === true)
      );
    },
    { homeSelector: HOME_SELECTOR, selectedRuntime: runtime },
    { timeout: 30_000 }
  );

  const error = await page.locator(`${HOME_SELECTOR} [data-home-demo-host]`).textContent();
  expect(error, `${runtime} home demo`).not.toContain('[Home Demo Error]');
}

async function chooseRuntime(page: Page, root: ReturnType<Page['locator']>, runtime: string) {
  await root.locator('[data-home-demo-runtime] wc-shadcn-select-trigger').click();
  await page
    .locator(`wc-shadcn-select-item[data-value="${runtime}"]:visible`)
    .last()
    .click({ force: true });
  await waitForHomeRuntime(page, runtime);
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(HOME_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Homepage Runtime demobox browser smoke', () => {
  it('remounts locally and follows the global adapter preference across all runtimes', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
    const home = page.locator(HOME_SELECTOR);
    const globalRoot = page.locator('wc-shadcn-select-root[data-adapter-select-root]').first();

    try {
      await home.waitFor({ state: 'visible' });
      await waitForHomeRuntime(page, 'wc');
      for (const runtime of RUNTIMES) {
        await chooseRuntime(page, home, runtime);
        await expect
          .poll(
            () =>
              home
                .locator('[data-home-demo-runtime] wc-shadcn-select-trigger')
                .evaluate((element) => document.activeElement === element),
            { timeout: 10_000 }
          )
          .toBe(true);
        expect(
          await page
            .locator('wc-shadcn-select-root[data-adapter-select-root]')
            .first()
            .getAttribute('data-value'),
          `${runtime} global preference`
        ).toBe(runtime);
      }

      await globalRoot.locator('wc-shadcn-select-trigger').click();
      await page
        .locator('wc-shadcn-select-item[data-value="vue"]:visible')
        .last()
        .click({ force: true });
      await waitForHomeRuntime(page, 'vue');
      expect(await home.locator('[data-home-demo-runtime]').getAttribute('data-value')).toBe('vue');
    } finally {
      await context.close();
    }
  }, 180_000);
});
