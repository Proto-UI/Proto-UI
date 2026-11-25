// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, openRoute, startServer, stopServer } from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/toast/';
const POSITIONS = [
  ['Top Left', 'top-left'],
  ['Top Center', 'top-center'],
  ['Top Right', 'top-right'],
  ['Bottom Left', 'bottom-left'],
  ['Bottom Center', 'bottom-center'],
  ['Bottom Right', 'bottom-right'],
] as const;

let browser: Browser;
let baseUrl: string;

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe('Toast positioning in the documentation viewport', () => {
  it.each([
    { width: 1280, height: 900, positions: POSITIONS },
    { width: 1100, height: 750, positions: [POSITIONS[0], POSITIONS[5]] },
    { width: 900, height: 750, positions: [POSITIONS[0], POSITIONS[5]] },
    { width: 390, height: 600, positions: [POSITIONS[2], POSITIONS[3]] },
  ])(
    'reserves the fixed header at $width × $height',
    async ({ width, height, positions }) => {
      const { context, page } = await openRoute(browser, baseUrl, ROUTE, { width, height });
      const samples: Array<Record<string, unknown>> = [];
      try {
        const preview = page.locator('[data-demo-id="demo-shadcn-toast-position"]');
        const viewport = preview.locator('[data-demo-ref="viewport"]');
        const toast = preview.locator('[data-demo-ref="toast"]');

        for (const [label, position] of positions) {
          await preview.getByRole('button', { name: label, exact: true }).click();
          const title = toast.getByText('Toast (' + label + ')', { exact: true });
          await title.waitFor({ state: 'visible', timeout: 3000 });

          const frame = await viewport.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const header = element
              .closest('.site-page-frame')
              ?.querySelector('header:has([data-docs-site-header])');
            if (!header) throw new Error('The documentation header is missing.');
            return {
              position: getComputedStyle(element).position,
              top: box.top,
              left: box.left,
              right: box.right,
              bottom: box.bottom,
              headerBottom: header.getBoundingClientRect().bottom,
              headerClearance: getComputedStyle(element).getPropertyValue('--header-height').trim(),
              inset: 1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize),
              maxHeight: parseFloat(getComputedStyle(element).maxHeight),
              viewportWidth: innerWidth,
              viewportHeight: innerHeight,
            };
          });
          const titleHit = await title.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return { top: box.top, hit: hit?.localName, ownsHit: !!hit && element.contains(hit) };
          });
          samples.push({ position, frame, titleHit });

          expect(frame.position).toBe('fixed');
          expect(frame.maxHeight).toBeCloseTo(
            frame.viewportHeight - frame.headerBottom - 2 * frame.inset
          );
          expect(frame.top).toBeGreaterThanOrEqual(frame.headerBottom + frame.inset - 1);
          expect(frame.bottom).toBeLessThanOrEqual(frame.viewportHeight - frame.inset + 1);
          if (position.startsWith('top-')) {
            expect(frame.top).toBeCloseTo(frame.headerBottom + frame.inset, 0);
          } else {
            expect(frame.viewportHeight - frame.bottom).toBeCloseTo(frame.inset, 0);
          }
          if (position.endsWith('-left')) {
            expect(frame.left).toBeCloseTo(frame.inset, 0);
          } else if (position.endsWith('-right')) {
            expect(frame.viewportWidth - frame.right).toBeCloseTo(frame.inset, 0);
          } else {
            expect((frame.left + frame.right) / 2).toBeCloseTo(frame.viewportWidth / 2, 0);
          }
          expect(titleHit.ownsHit).toBe(true);

          const evidence = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
          if (evidence && position.startsWith('top-')) {
            await mkdir(evidence, { recursive: true });
            await toast.screenshot({ path: path.join(evidence, width + '-' + position + '.png') });
          }
          await toast.getByRole('button', { name: 'Dismiss', exact: true }).click();
          await title.waitFor({ state: 'hidden', timeout: 3000 });
        }
      } finally {
        const evidence = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
        if (evidence) {
          await mkdir(evidence, { recursive: true });
          await writeFile(
            path.join(evidence, width + '-positions.json'),
            JSON.stringify(samples, null, 2) + '\n'
          );
        }
        await context.close();
      }
    },
    90_000
  );

  it('keeps the collapsed stack inside a narrow viewport and dismisses the front card', async () => {
    const { context, page } = await openRoute(browser, baseUrl, ROUTE, { width: 320, height: 900 });
    try {
      const preview = page.locator('[data-demo-id="demo-shadcn-toast"]');
      const trigger = preview.locator('[data-demo-ref="trigger"]');
      const cards = [0, 1, 2].map((index) =>
        preview.locator('[data-demo-ref="root-' + index + '"]')
      );
      for (const card of cards) {
        await trigger.click();
        await card.waitFor({ state: 'visible', timeout: 4000 });
      }
      const viewport = preview.locator('[data-demo-ref="viewport"]');
      await page.waitForFunction(
        () =>
          [10, 20, 30].every((layer, index) => {
            const card = document.querySelector(
              '[data-demo-id="demo-shadcn-toast"] [data-demo-ref="root-' + index + '"]'
            );
            return !!card && getComputedStyle(card).zIndex === String(layer);
          }),
        undefined,
        { timeout: 4000 }
      );
      const frame = await viewport.boundingBox();
      expect(frame).not.toBeNull();
      if (!frame) throw new Error('The Toast viewport is missing.');
      for (const card of cards) {
        const rect = await card.boundingBox();
        if (!rect) throw new Error('A stacked Toast card is missing.');
        expect(rect.x).toBeGreaterThanOrEqual(frame.x - 1);
        expect(rect.x + rect.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
      }
      await cards[2].getByRole('button', { name: 'Dismiss', exact: true }).click();
      await cards[2].waitFor({ state: 'hidden', timeout: 4000 });
      await cards[1].getByRole('button', { name: 'Dismiss', exact: true }).click();
      await cards[1].waitFor({ state: 'hidden', timeout: 4000 });
      expect(await cards[0].isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 30_000);
});
