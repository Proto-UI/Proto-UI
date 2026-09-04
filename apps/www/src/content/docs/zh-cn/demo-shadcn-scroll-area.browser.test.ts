// @vitest-environment node

import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/scroll-area/';
const EPSILON = 1;
const requestedRuntime = process.env.PROTO_UI_SHADCN_SCROLL_AREA_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_SHADCN_SCROLL_AREA_BROWSER_RUNTIME must be one of ${RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

async function bounds(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: expected rendered geometry.`);
  return box;
}

function expectClose(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(EPSILON);
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

describe.sequential('shadcn Scroll Area browser acceptance', () => {
  it('renders exact oriented chrome around one host-owned two-axis surface in every runtime', async () => {
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
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="scrollViewport"]', 1);
        const viewport = previewer.locator('[data-demo-ref="scrollViewport"]');
        const root = viewport.locator('xpath=..');
        const vertical = previewer.locator('[data-demo-ref="verticalScrollbar"]');
        const horizontal = previewer.locator('[data-demo-ref="horizontalScrollbar"]');
        const verticalThumb = previewer.locator('[data-demo-ref="verticalThumb"]');
        const horizontalThumb = previewer.locator('[data-demo-ref="horizontalThumb"]');

        await page.waitForFunction(
          () => {
            const surface = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="scrollViewport"]'
            );
            return Boolean(
              surface &&
              surface.scrollWidth > surface.clientWidth &&
              surface.scrollHeight > surface.clientHeight &&
              surface.hasAttribute('data-scroll-horizontal-can-scroll-after') &&
              surface.hasAttribute('data-scroll-vertical-can-scroll-after')
            );
          },
          undefined,
          { timeout: 20_000 }
        );

        const facts = await viewport.evaluate((surface) => ({
          projection: surface.getAttribute('data-pui-scroll-projection'),
          axes: surface.getAttribute('data-scroll-axes'),
          role: surface.getAttribute('role'),
          tabIndex: surface.getAttribute('tabindex'),
          clientWidth: surface.clientWidth,
          clientHeight: surface.clientHeight,
          scrollWidth: surface.scrollWidth,
          scrollHeight: surface.scrollHeight,
          scrollLeft: surface.scrollLeft,
          scrollTop: surface.scrollTop,
        }));
        expect(facts.projection, `${runtime}/projection`).toBe('composed');
        expect(facts.axes, `${runtime}/axes`).toBe('both');
        expect(facts.role, `${runtime}/role`).toBeNull();
        expect(facts.tabIndex, `${runtime}/tabindex`).toBe('0');
        expect(facts.scrollWidth, `${runtime}/horizontal-overflow`).toBeGreaterThan(
          facts.clientWidth
        );
        expect(facts.scrollHeight, `${runtime}/vertical-overflow`).toBeGreaterThan(
          facts.clientHeight
        );

        const viewportBeforeFocus = await bounds(viewport, `${runtime}/viewport-before-focus`);
        await page.keyboard.press('Tab');
        await viewport.focus();
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-previewer-id] [data-demo-ref="scrollViewport"]')
              ?.hasAttribute('data-focus-visible') === true,
          undefined,
          { timeout: 10_000 }
        );
        const focusPaint = await viewport.evaluate((element) => {
          const style = getComputedStyle(element);
          return { boxShadow: style.boxShadow, outlineWidth: style.outlineWidth };
        });
        expect(focusPaint.boxShadow, `${runtime}/focus-ring`).not.toBe('none');
        expect(focusPaint.outlineWidth, `${runtime}/focus-outline`).toBe('1px');
        const viewportAfterFocus = await bounds(viewport, `${runtime}/viewport-after-focus`);
        for (const property of ['x', 'y', 'width', 'height'] as const) {
          expectClose(
            viewportAfterFocus[property],
            viewportBeforeFocus[property],
            `${runtime}/focus-geometry/${property}`
          );
        }
        await viewport.evaluate((element) => (element as HTMLElement).blur());
        // transition-colors includes border-color; sample the declared transparent edge after it settles.
        await page.waitForTimeout(200);

        const rootBox = await bounds(root, `${runtime}/root`);
        const viewportBox = await bounds(viewport, `${runtime}/viewport`);
        const verticalBox = await bounds(vertical, `${runtime}/vertical`);
        const horizontalBox = await bounds(horizontal, `${runtime}/horizontal`);
        const verticalStyle = await vertical.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            position: style.position,
            width: style.width,
            top: style.top,
            right: style.right,
            borderWidth: style.borderTopWidth,
            borderColor: style.borderTopColor,
            flexDirection: style.flexDirection,
          };
        });
        const horizontalStyle = await horizontal.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            position: style.position,
            height: style.height,
            bottom: style.bottom,
            left: style.left,
            borderWidth: style.borderTopWidth,
            borderColor: style.borderTopColor,
            flexDirection: style.flexDirection,
          };
        });

        expect(verticalStyle, `${runtime}/vertical-style`).toEqual({
          position: 'absolute',
          width: '10px',
          top: '0px',
          right: '0px',
          borderWidth: '2px',
          borderColor: 'rgba(0, 0, 0, 0)',
          flexDirection: 'row',
        });
        expect(horizontalStyle, `${runtime}/horizontal-style`).toEqual({
          position: 'absolute',
          height: '10px',
          bottom: '0px',
          left: '0px',
          borderWidth: '2px',
          borderColor: 'rgba(0, 0, 0, 0)',
          flexDirection: 'column',
        });
        expectClose(verticalBox.y, viewportBox.y, `${runtime}/vertical-top`);
        expectClose(
          verticalBox.x + verticalBox.width,
          viewportBox.x + viewportBox.width,
          `${runtime}/vertical-right`
        );
        expectClose(verticalBox.height, viewportBox.height, `${runtime}/vertical-height`);
        expectClose(horizontalBox.x, viewportBox.x, `${runtime}/horizontal-left`);
        expectClose(
          horizontalBox.y + horizontalBox.height,
          viewportBox.y + viewportBox.height,
          `${runtime}/horizontal-bottom`
        );
        expectClose(horizontalBox.width, viewportBox.width, `${runtime}/horizontal-width`);
        expectClose(verticalBox.y - rootBox.y, 1, `${runtime}/vertical-root-border-inset`);
        expectClose(
          rootBox.x + rootBox.width - (verticalBox.x + verticalBox.width),
          1,
          `${runtime}/vertical-root-border-right`
        );
        expectClose(horizontalBox.x - rootBox.x, 1, `${runtime}/horizontal-root-border-inset`);
        expectClose(
          rootBox.y + rootBox.height - (horizontalBox.y + horizontalBox.height),
          1,
          `${runtime}/horizontal-root-border-bottom`
        );

        for (const [name, thumb] of [
          ['vertical', verticalThumb],
          ['horizontal', horizontalThumb],
        ] as const) {
          const paint = await thumb.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              position: style.position,
              flexGrow: style.flexGrow,
              borderRadius: style.borderRadius,
              backgroundColor: style.backgroundColor,
              role: element.getAttribute('role'),
              tabIndex: (element as HTMLElement).tabIndex,
            };
          });
          expect(paint.position, `${runtime}/${name}-thumb-position`).toBe('relative');
          expect(paint.flexGrow, `${runtime}/${name}-thumb-flex`).toBe('1');
          expect(paint.borderRadius, `${runtime}/${name}-thumb-radius`).not.toBe('0px');
          expect(paint.backgroundColor, `${runtime}/${name}-thumb-fill`).not.toBe(
            'rgba(0, 0, 0, 0)'
          );
          expect(paint.role, `${runtime}/${name}-thumb-role`).toBeNull();
          expect(paint.tabIndex, `${runtime}/${name}-thumb-tabindex`).toBe(-1);
        }

        const verticalStart = await bounds(verticalThumb, `${runtime}/vertical-thumb-start`);
        await page.mouse.move(
          verticalStart.x + verticalStart.width / 2,
          verticalStart.y + verticalStart.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          verticalStart.x + verticalStart.width / 2,
          verticalStart.y + verticalStart.height / 2 + 36,
          { steps: 4 }
        );
        await page.mouse.up();
        await expect
          .poll(() => viewport.evaluate((surface) => surface.scrollTop), { message: runtime })
          .toBeGreaterThan(0);

        const horizontalStart = await bounds(horizontalThumb, `${runtime}/horizontal-thumb-start`);
        await page.mouse.move(
          horizontalStart.x + horizontalStart.width / 2,
          horizontalStart.y + horizontalStart.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          horizontalStart.x + horizontalStart.width / 2 + 36,
          horizontalStart.y + horizontalStart.height / 2,
          { steps: 4 }
        );
        await page.mouse.up();
        await expect
          .poll(() => viewport.evaluate((surface) => surface.scrollLeft), { message: runtime })
          .toBeGreaterThan(0);

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
