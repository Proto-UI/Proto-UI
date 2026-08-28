// @vitest-environment node

import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  runtimeSelectTrigger,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const DROPDOWN_ROUTE = '/en/ui-libraries/shadcn/dropdown-menu/';

let browser: Browser;
let baseUrl = '';

type RingOffsetSample = {
  background: number[];
  offset: number[];
  offsetShadow: string;
  explicitOffsetColor: string;
  focusVisible: boolean;
};

async function focusDropdownTrigger(page: Page, previewer: Locator): Promise<void> {
  await runtimeSelectTrigger(previewer).focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(
    () => {
      const trigger = document.querySelector<HTMLElement>('[data-previewer-id] [role="button"]');
      if (!trigger?.hasAttribute('data-focus-visible')) return false;
      return Boolean(getComputedStyle(trigger).getPropertyValue('--pui-ring-offset-shadow').trim());
    },
    undefined,
    { timeout: 10_000 }
  );
}

async function ringOffsetSample(page: Page): Promise<RingOffsetSample> {
  return page.evaluate(() => {
    const trigger = document.querySelector<HTMLElement>('[data-previewer-id] [role="button"]');
    if (!trigger) throw new Error('The shadcn Dropdown Menu demo must render its trigger.');

    const probe = document.createElement('span');
    probe.style.boxShadow = 'var(--pui-ring-offset-shadow)';
    trigger.appendChild(probe);

    const triggerStyle = getComputedStyle(trigger);
    const offsetShadow = getComputedStyle(probe).boxShadow;
    probe.remove();

    const colorMatch = offsetShadow.match(
      /^(?:(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|#[0-9a-f]+|[a-z]+)/i
    );
    if (!colorMatch) {
      throw new Error(`Unable to read the ring offset colour from: ${offsetShadow}`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

    const paint = (color: string): number[] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };

    return {
      background: paint(triggerStyle.backgroundColor),
      offset: paint(colorMatch[0]),
      offsetShadow,
      explicitOffsetColor: triggerStyle.getPropertyValue('--pui-ring-offset-color').trim(),
      focusVisible: trigger.hasAttribute('data-focus-visible'),
    };
  });
}

beforeAll(async () => {
  baseUrl = await startServer(DROPDOWN_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe.sequential('ring offset browser regressions', () => {
  it('uses the dark control surface when the prototype omits an offset colour', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, DROPDOWN_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="button"]', 1);
        await applyColorScheme(page, 'dark');
        await focusDropdownTrigger(page, previewer);

        // The trigger runs `transition-colors`: on the theme flip its
        // background-color animates over 150ms while the ring offset colour,
        // resolved through custom properties, snaps immediately. Poll until the
        // two painted colours agree instead of sampling a mid-transition frame.
        let sample = await ringOffsetSample(page);
        for (
          let attempt = 0;
          sample.offset.join() !== sample.background.join() && attempt < 60;
          attempt += 1
        ) {
          await page.waitForTimeout(15);
          sample = await ringOffsetSample(page);
        }
        expect(sample.focusVisible, `${runtime}/focus-visible`).toBe(true);
        expect(sample.explicitOffsetColor, `${runtime}/implicit-offset`).toBe('');
        expect(sample.offsetShadow, `${runtime}/offset-shadow`).not.toBe('none');
        expect(sample.offset, `${runtime}/painted-offset`).toEqual(sample.background);
      }
    } finally {
      await context.close();
    }
  }, 180_000);
});
