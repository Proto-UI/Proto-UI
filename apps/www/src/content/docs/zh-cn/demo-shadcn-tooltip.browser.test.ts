// @vitest-environment node

import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/tooltip/';
const requestedRuntime = process.env.PROTO_UI_SHADCN_TOOLTIP_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_SHADCN_TOOLTIP_BROWSER_RUNTIME must be one of ${RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('shadcn Tooltip browser acceptance', () => {
  it('renders state feedback and a supplementary body portal in every public runtime', async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${ROUTE}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    const previewer = page.locator('[data-previewer-id]').first();
    await previewer.waitFor({ state: 'visible', timeout: 120_000 });

    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="accountTrigger"]', 1);
        const account = previewer.locator('[data-demo-ref="accountTrigger"]');
        const notifications = previewer.locator('[data-demo-ref="notificationsTrigger"]');

        expect(await account.getAttribute('tabindex'), `${runtime}/account-tabindex`).toBe('0');
        expect(
          await notifications.getAttribute('tabindex'),
          `${runtime}/notifications-tabindex`
        ).toBe('0');
        expect(await account.getAttribute('role'), `${runtime}/account-role`).toBeNull();
        expect(
          await account.getAttribute('aria-describedby'),
          `${runtime}/closed-description`
        ).toBeNull();
        expect(await page.getByRole('tooltip').count(), `${runtime}/closed-content`).toBe(0);

        await page.keyboard.press('Tab');
        await account.focus();
        await expect.poll(() => page.getByRole('tooltip').count(), { message: runtime }).toBe(1);

        const describedBy = await account.getAttribute('aria-describedby');
        const tooltipId = describedBy?.split(/\s+/).find(Boolean);
        if (!tooltipId) throw new Error(`${runtime}: focused Trigger did not publish describedBy.`);
        const content = page.locator(`[id="${tooltipId}"]`);

        expect(await content.getAttribute('role'), `${runtime}/content-role`).toBe('tooltip');
        expect(await content.getAttribute('tabindex'), `${runtime}/content-tabindex`).toBeNull();
        expect(await content.textContent(), `${runtime}/content-text`).toContain(
          'Open account settings.'
        );
        expect(
          await content.locator('a,button,input,select,textarea,[tabindex]').count(),
          `${runtime}/content-focusables`
        ).toBe(0);
        expect(await content.locator('svg').count(), `${runtime}/arrow-absence`).toBe(0);

        expect(
          await page.evaluate(
            ({ id }) => {
              const preview = document.querySelector('[data-previewer-id]');
              const portaled = document.getElementById(id);
              return Boolean(
                preview &&
                portaled &&
                document.body.contains(portaled) &&
                !preview.contains(portaled)
              );
            },
            { id: tooltipId }
          ),
          `${runtime}/renderer-owned-body-portal`
        ).toBe(true);

        await account.hover();
        await expect
          .poll(() => account.evaluate((element) => getComputedStyle(element).opacity), {
            message: `${runtime}/hover-opacity`,
          })
          .toBe('0.7');
        expect(
          await account.evaluate((element) => getComputedStyle(element).boxShadow),
          `${runtime}/focus-ring`
        ).not.toBe('none');

        const triggerBox = await account.boundingBox();
        if (!triggerBox) throw new Error(`${runtime}: Trigger has no rendered geometry.`);
        await page.mouse.move(
          triggerBox.x + triggerBox.width / 2,
          triggerBox.y + triggerBox.height / 2
        );
        await page.mouse.down();
        try {
          await expect
            .poll(() => account.evaluate((element) => getComputedStyle(element).transform), {
              message: `${runtime}/pressed-scale`,
            })
            .not.toBe('none');
        } finally {
          await page.mouse.up();
        }

        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(page, colorScheme);
          const paint = await content.evaluate((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
              borderRadius: style.borderRadius,
              borderWidth: style.borderTopWidth,
              backgroundColor: style.backgroundColor,
              color: style.color,
              boxShadow: style.boxShadow,
              fontSize: style.fontSize,
              paddingInline: style.paddingInline,
              paddingBlock: style.paddingBlock,
              width: rect.width,
              height: rect.height,
            };
          });
          expect(paint.borderRadius, `${runtime}/${colorScheme}/radius`).not.toBe('0px');
          expect(paint.borderWidth, `${runtime}/${colorScheme}/border`).toBe('1px');
          expect(paint.backgroundColor, `${runtime}/${colorScheme}/background`).not.toBe(
            'rgba(0, 0, 0, 0)'
          );
          expect(paint.color, `${runtime}/${colorScheme}/color`).not.toBe(paint.backgroundColor);
          expect(paint.boxShadow, `${runtime}/${colorScheme}/shadow`).not.toBe('none');
          expect(paint.fontSize, `${runtime}/${colorScheme}/font-size`).toBe('12px');
          expect(paint.paddingInline, `${runtime}/${colorScheme}/padding-inline`).toBe('12px');
          expect(paint.paddingBlock, `${runtime}/${colorScheme}/padding-block`).toBe('6px');
          expect(paint.width, `${runtime}/${colorScheme}/width`).toBeGreaterThan(20);
          expect(paint.height, `${runtime}/${colorScheme}/height`).toBeGreaterThan(10);
        }

        await page.keyboard.press('Escape');
        await expect.poll(() => page.getByRole('tooltip').count(), { message: runtime }).toBe(0);
        expect(
          await account.getAttribute('aria-describedby'),
          `${runtime}/closed-description`
        ).toBeNull();
        expect(
          await account.evaluate(
            (trigger) =>
              document.activeElement === trigger || trigger.contains(document.activeElement)
          ),
          `${runtime}/focus-retained`
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          ),
          `${runtime}/document-overflow`
        ).toBe(0);
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
