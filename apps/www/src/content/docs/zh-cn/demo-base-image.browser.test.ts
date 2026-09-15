// @vitest-environment node

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/en/ui-libraries/base/image/';
const RUNTIMES = ['wc', 'react', 'vue'] as const;
let browser: Browser;
let baseUrl = '';

function physicalImage(previewer: Locator, ref: string): Locator {
  return previewer.locator(`img[data-demo-ref="${ref}"], [data-demo-ref="${ref}"] img`);
}

async function state(previewer: Locator, expected: string): Promise<void> {
  await expect
    .poll(() => previewer.locator('[data-demo-ref="status"]').textContent())
    .toBe(expected);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// T-IMAGE-VIEW-0001-CASE-PUBLIC-BROWSER
describe.sequential('Base Image public consumer browser evidence', () => {
  for (const runtime of RUNTIMES) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const width of [1280, 390]) {
        it(`${runtime} projects fit, a11y, and resource transitions in ${scheme} at ${width}px`, async () => {
          const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
            width,
            height: 900,
          });
          let release: (() => void) | undefined;
          try {
            await applyColorScheme(page, scheme);
            await selectRuntime(page, previewer, runtime, 'img', 5);
            await state(previewer, 'idle');
            expect(await previewer.locator('.host img').count()).toBe(5);

            // P-BASE-IMAGE-DECLARATION/ALT-TEXT/FIT and D-IMAGE-VIEW-PROJECTION-0001-E.
            // Frame dimensions are authored by this demo, not Base Image defaults.
            const widths: number[] = [];
            for (const fit of ['contain', 'cover', 'fill']) {
              const image = physicalImage(previewer, `fit-${fit}`);
              expect(await image.count()).toBe(1);
              await expect
                .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
                .toBe(640);
              const facts = await image.evaluate((el) => {
                const image = el as HTMLImageElement;
                const rect = image.getBoundingClientRect();
                return {
                  fit: getComputedStyle(image).objectFit,
                  position: getComputedStyle(image).objectPosition,
                  height: rect.height,
                  width: rect.width,
                  alt: image.alt,
                  tabIndex: image.tabIndex,
                };
              });
              expect(facts).toMatchObject({
                fit,
                position: '50% 50%',
                height: 112,
                alt: `Mountains and a sun (${fit})`,
                tabIndex: -1,
              });
              expect(facts.width).toBeGreaterThan(0);
              widths.push(facts.width);
            }
            expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
            expect(await physicalImage(previewer, 'decorative').getAttribute('alt')).toBe('');
            expect(await previewer.locator('.host').getByRole('img').count()).toBe(4);

            const image = physicalImage(previewer, 'resource');
            const log = previewer.locator('[data-demo-ref="transitions"]');
            const load = previewer.getByRole('button', { name: 'Load landscape', exact: true });
            await load.press('Enter');
            await state(previewer, 'loaded');
            expect(await image.getAttribute('src')).toBe(
              '/images/base-image/landscape.svg?resource'
            );
            expect(await image.getAttribute('alt')).toBe('Selected illustration');
            expect(await log.textContent()).toBe('loading → loaded');
            expect(
              await previewer
                .getByRole('img', { name: 'Selected illustration', exact: true })
                .count()
            ).toBe(1);

            // Equal source synchronization cannot restart a settled request (C-IMAGE-VIEW-0001-E).
            await load.click();
            await settle(page);
            expect(await log.textContent()).toBe('loading → loaded');

            // Hold a real response, never substitute Image state or native decode.
            const pending = new Promise<void>((resolve) => {
              release = resolve;
            });
            await page.route('**/images/base-image/portrait.svg?resource', async (route) => {
              await pending;
              await route.continue();
            });
            await previewer.getByRole('button', { name: 'Replace source', exact: true }).click();
            await state(previewer, 'loading');
            expect(await image.getAttribute('src')).toBe(
              '/images/base-image/portrait.svg?resource'
            );
            expect(await log.textContent()).toBe('loading → loaded → loading');
            // Replacement clears the old visual (C-IMAGE-VIEW-0001-G).
            expect(await image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(0);
            release!();
            await state(previewer, 'loaded');
            expect(
              await image.evaluate((el) => [
                (el as HTMLImageElement).naturalWidth,
                (el as HTMLImageElement).naturalHeight,
              ])
            ).toEqual([320, 480]);
            expect(await log.textContent()).toBe('loading → loaded → loading → loaded');

            const screenshotDir = process.env.PROTO_UI_IMAGE_SCREENSHOT_DIR;
            if (screenshotDir) {
              await mkdir(screenshotDir, { recursive: true });
              await previewer.screenshot({
                path: path.join(screenshotDir, `${runtime}-${scheme}-${width}.png`),
                style: 'astro-dev-toolbar { visibility: hidden; }',
              });
            }
            // P-BASE-IMAGE-STATUS / C-IMAGE-VIEW-0001-F: failure and clear use the canonical surface.
            await previewer.getByRole('button', { name: 'Broken source', exact: true }).click();
            await state(previewer, 'error');
            expect(await image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(0);
            expect(await image.getAttribute('alt')).toBe('Selected illustration');
            expect(await log.textContent()).toBe(
              'loading → loaded → loading → loaded → loading → error'
            );
            await previewer
              .getByRole('button', { name: 'Clear source', exact: true })
              .press('Space');
            await state(previewer, 'idle');
            expect(await image.getAttribute('src')).toBeNull();
            expect(await log.textContent()).toBe(
              'loading → loaded → loading → loaded → loading → error → idle'
            );
            expect(await previewer.locator('.host img').count()).toBe(5);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
              )
            ).toBeLessThanOrEqual(0);
          } finally {
            release?.();
            await context.close();
          }
        }, 60_000);
      }
    }
  }

  it('keeps the Chinese page on the same three-adapter public demo', async () => {
    const { context, page, previewer } = await openRoute(
      browser,
      baseUrl,
      '/zh-cn/ui-libraries/base/image/',
      { width: 390, height: 900 }
    );
    try {
      await selectRuntime(page, previewer, 'wc', 'img', 5);
      expect(
        await page.getByRole('heading', { name: 'Props 与 Exposes', exact: true }).count()
      ).toBe(1);
      expect(await previewer.getAttribute('data-demo-id')).toBe('demo-base-image');
      expect(await physicalImage(previewer, 'fit-cover').getAttribute('alt')).toBe(
        'Mountains and a sun (cover)'
      );
    } finally {
      await context.close();
    }
  }, 60_000);
});
