// @vitest-environment node

import {
  RUNTIMES,
  type RuntimeId,
  startServer,
  stopServer,
  launchBrowser,
  openRoute,
  selectRuntime,
} from './browser-harness';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BUTTON_ROUTE = '/en/ui-libraries/brutalist/components/button/';
const BUTTON_DEMO_ID = 'demo-brutalist-button';

let browser: Browser;
let page: Page;
let baseUrl: string;

beforeAll(async () => {
  baseUrl = await startServer(BUTTON_ROUTE);
  browser = await launchBrowser();
  page = await browser.newPage();
}, 120_000);

afterAll(async () => {
  await page?.close();
  await browser?.close();
  await stopServer();
});

describe.sequential('Brutalist Button browser regressions', () => {
  for (const runtime of RUNTIMES) {
    it(`renders a Button with square corners and hard shadow in ${runtime}`, async () => {
      const previewer = await openRoute(page, baseUrl, BUTTON_ROUTE, BUTTON_DEMO_ID);
      // The demo has 9 buttons inside a box wrapper, so use descendant selector
      await selectRuntime(page, previewer, runtime, '.host [data-pui-root]', 9);
      const button = previewer.locator('.host [data-pui-root]').first();
      await button.waitFor({ state: 'visible' });
      const style = await button.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          borderRadius: cs.borderRadius,
          borderWidth: cs.borderTopWidth,
          boxShadow: cs.boxShadow,
        };
      });
      expect(style.borderRadius).toBe('0px');
      expect(style.borderWidth).toBe('2px');
      expect(style.boxShadow).toContain('3px 3px');
    });

    it(`preserves disabled state visually in ${runtime}`, async () => {
      const previewer = await openRoute(page, baseUrl, BUTTON_ROUTE, BUTTON_DEMO_ID);
      await selectRuntime(page, previewer, runtime, '.host [data-pui-root]', 9);
      const disabled = previewer.locator('.host [data-pui-root][data-disabled]').first();
      await disabled.waitFor({ state: 'visible' });
      const opacity = await disabled.evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeLessThan(1);
    });
  }
});
