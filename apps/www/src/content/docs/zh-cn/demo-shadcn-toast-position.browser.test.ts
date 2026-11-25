// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  launchBrowser,
  openRoute,
  RUNTIMES,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/toast/';
const STACK_DEMO = 'demo-shadcn-toast';
const POSITION_DEMO = 'demo-shadcn-toast-position';
const DEMO_ROOT = '[data-demo-ref="toast-demo"]';
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

const previewFor = (page: Page, id: string) => page.locator(`[data-demo-id="${id}"]`);

async function ownedViewport(preview: Locator) {
  const owner = await preview.locator(DEMO_ROOT).getAttribute('data-demo-owner');
  if (!owner) throw new Error('The Toast demo owner is missing.');
  const viewport = preview.page().locator(
    `[data-demo-ref="viewport"]:is([data-demo-owner=${JSON.stringify(owner)}], .pui-owner-${owner})`
  );
  await viewport.waitFor({ state: 'attached' });
  expect(
    await viewport.evaluate(
      (element) =>
        element.ownerDocument.body.contains(element) && !element.closest('.site-page-frame')
    )
  ).toBe(true);
  return viewport;
}

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.each(RUNTIMES)('Toast positioning in the documentation viewport (%s)', (runtime) => {
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
        const preview = previewFor(page, POSITION_DEMO);
        await selectRuntime(page, preview, runtime, DEMO_ROOT, 1);
        const viewport = await ownedViewport(preview);
        const toast = viewport.locator('[data-demo-ref="toast"]');
        const header = page.locator('.site-page-frame > header:has([data-docs-site-header])');

        for (const [label, position] of positions) {
          const command = preview.getByRole('button', { name: label, exact: true });
          await command.scrollIntoViewIfNeeded();
          expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
          await command.click();
          const title = toast.getByText('Toast (' + label + ')', { exact: true });
          await title.waitFor({ state: 'visible', timeout: 3000 });

          const headerBottom = await header.evaluate(
            (element) => element.getBoundingClientRect().bottom
          );
          const frame = await viewport.evaluate((element, headerBottom) => {
            const box = element.getBoundingClientRect();
            return {
              position: getComputedStyle(element).position,
              top: box.top,
              left: box.left,
              right: box.right,
              bottom: box.bottom,
              headerBottom,
              headerClearance: getComputedStyle(element).getPropertyValue('--header-height').trim(),
              inset: 1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize),
              maxHeight: parseFloat(getComputedStyle(element).maxHeight),
              viewportWidth: innerWidth,
              viewportHeight: innerHeight,
            };
          }, headerBottom);
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
            await toast.screenshot({
              path: path.join(evidence, `${runtime}-${width}-${position}.png`),
            });
          }
          await toast.getByRole('button', { name: 'Dismiss', exact: true }).click();
          await title.waitFor({ state: 'hidden', timeout: 3000 });
        }
      } finally {
        const evidence = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
        if (evidence) {
          await mkdir(evidence, { recursive: true });
          await writeFile(
            path.join(evidence, `${runtime}-${width}-positions.json`),
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
      const preview = previewFor(page, STACK_DEMO);
      await selectRuntime(page, preview, runtime, DEMO_ROOT, 1);
      const trigger = preview.locator('[data-demo-ref="trigger"]');
      const viewport = await ownedViewport(preview);
      const cards = [0, 1, 2, 3].map((index) => viewport.locator(`[data-demo-ref="root-${index}"]`));
      for (const card of cards) {
        await trigger.click();
        await card.waitFor({ state: 'visible', timeout: 4000 });
      }
      await expect
        .poll(
          async () => {
            const layers = await Promise.all(
              cards.slice(1).map((card) =>
                card.evaluate((element) => {
                  const { position, order, zIndex } = getComputedStyle(element);
                  return { position, order: Number(order), zIndex: Number(zIndex) };
                })
              )
            );
            return {
              positions: layers.map((layer) => layer.position),
              order: layers.map((layer) => layer.order),
              newestPaintsAboveOlder:
                layers[0]!.zIndex < layers[1]!.zIndex && layers[1]!.zIndex < layers[2]!.zIndex,
            };
          },
          { timeout: 4000 }
        )
        .toEqual({
          positions: ['absolute', 'absolute', 'relative'],
          order: [2, 1, 0],
          newestPaintsAboveOlder: true,
        });
      expect(await cards[0].count()).toBe(1);
      expect(await cards[0].isHidden()).toBe(true);
      const frame = await viewport.boundingBox();
      expect(frame).not.toBeNull();
      if (!frame) throw new Error('The Toast viewport is missing.');
      for (const card of cards.slice(1)) {
        const rect = await card.boundingBox();
        if (!rect) throw new Error('A stacked Toast card is missing.');
        expect(rect.x).toBeGreaterThanOrEqual(frame.x - 1);
        expect(rect.x + rect.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
      }
      await cards[3].getByRole('button', { name: 'Dismiss', exact: true }).click();
      await cards[3].waitFor({ state: 'hidden', timeout: 4000 });
      await cards[0].waitFor({ state: 'visible', timeout: 4000 });
      await cards[2].getByRole('button', { name: 'Dismiss', exact: true }).click();
      await cards[2].waitFor({ state: 'hidden', timeout: 4000 });
      await cards[1].getByRole('button', { name: 'Dismiss', exact: true }).click();
      await cards[1].waitFor({ state: 'hidden', timeout: 4000 });
      expect(await cards[0].isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 30_000);

  it('dismisses only the owner’s notifications across body portals', async () => {
    const { context, page } = await openRoute(browser, baseUrl, ROUTE, { width: 1280, height: 900 });
    try {
      const position = previewFor(page, POSITION_DEMO);
      const stack = previewFor(page, STACK_DEMO);
      await selectRuntime(page, position, runtime, DEMO_ROOT, 1);
      await selectRuntime(page, stack, runtime, DEMO_ROOT, 1);
      const positioned = (await ownedViewport(position)).locator('[data-demo-ref="toast"]');
      const stacked = (await ownedViewport(stack)).locator('[data-demo-ref="root-0"]');
      await stack.getByRole('button', { name: 'Show Toast', exact: true }).click();
      await stacked.waitFor({ state: 'visible' });
      await position.getByRole('button', { name: 'Top Left', exact: true }).click();
      await positioned.waitFor({ state: 'visible' });
      await position.getByRole('button', { name: 'Dismiss All', exact: true }).click();
      await positioned.waitFor({ state: 'hidden' });
      expect(await stacked.isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 60_000);
});
