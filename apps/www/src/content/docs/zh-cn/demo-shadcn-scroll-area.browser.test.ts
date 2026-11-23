// @vitest-environment node

import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';
import { documentRect } from './browser-geometry';

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

async function scrollFacts(viewport: Locator) {
  return viewport.evaluate((surface) => ({
    scrollTop: surface.scrollTop,
    scrollLeft: surface.scrollLeft,
    clientWidth: surface.clientWidth,
    clientHeight: surface.clientHeight,
    scrollWidth: surface.scrollWidth,
    scrollHeight: surface.scrollHeight,
    attributes: Object.fromEntries(
      Array.from(surface.attributes)
        .filter(({ name }) => name.startsWith('data-scroll-'))
        .map(({ name, value }) => [name, value])
    ),
  }));
}

async function thumbDragStart(page: Page, thumb: Locator, viewport: Locator, label: string) {
  const box = await bounds(thumb, label);
  const before = await scrollFacts(viewport);
  console.info('[shadcn-scroll-thumb-drag-geometry]', JSON.stringify({ label, box, before }));
  expect(box.width, `${label}/width`).toBeGreaterThan(0);
  expect(box.height, `${label}/height`).toBeGreaterThan(0);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  const hit = await thumb.evaluate((element, point) => {
    const target = document.elementFromPoint(point.x, point.y);
    const style = getComputedStyle(element);
    return {
      onThumb: Boolean(target && element.contains(target)),
      target: target?.tagName ?? null,
      targetRef: target?.getAttribute('data-demo-ref') ?? null,
      stack: document.elementsFromPoint(point.x, point.y).map((item) => ({
        tag: item.tagName,
        ref: item.getAttribute('data-demo-ref'),
      })),
      flexGrow: style.flexGrow,
      flexBasis: style.flexBasis,
      width: style.width,
      height: style.height,
    };
  }, point);
  console.info('[shadcn-scroll-thumb-drag-hit]', JSON.stringify({ label, point, hit }));
  expect(hit.onThumb, `${label}/pointer hit ${hit.target}`).toBe(true);
  return { box, before };
}

async function checkZeroBasisCounterexample(
  thumb: Locator,
  axis: 'vertical' | 'horizontal',
  label: string
) {
  // A bounded native CSS counterexample on the actual Thumb, not a simulation
  // of layout or a claim to rerun the old product. Run after the unmodified
  // consumer's input checks and restore before asynchronous host/observer
  // delivery, including when measurement throws.
  const comparison = await thumb.evaluate((element) => {
    const target = element as HTMLElement;
    const rect = () => {
      const box = target.getBoundingClientRect();
      return { width: box.width, height: box.height };
    };
    const before = rect();
    const value = target.style.getPropertyValue('flex-basis');
    const priority = target.style.getPropertyPriority('flex-basis');
    let zeroBasis: { width: number; height: number };
    try {
      target.style.setProperty('flex-basis', '0%');
      zeroBasis = rect();
    } finally {
      if (value) target.style.setProperty('flex-basis', value, priority);
      else target.style.removeProperty('flex-basis');
    }
    return { before, zeroBasis, restored: rect() };
  });
  console.info(
    '[shadcn-scroll-thumb-zero-basis-counterexample]',
    JSON.stringify({ label, axis, ...comparison })
  );
  const crossAxis = axis === 'vertical' ? 'width' : 'height';
  expect(comparison.before[crossAxis], `${label}/ordinary-cross-axis`).toBeCloseTo(7, 5);
  expect(comparison.zeroBasis[crossAxis], `${label}/zero-basis-cross-axis`).toBe(0);
  expect(comparison.restored, `${label}/restored`).toEqual(comparison.before);
}

async function focusGeometry(locator: Locator, label: string) {
  // Capture both values atomically: focus can scroll the document between samples.
  const measurement = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      viewportRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scrollOffset: { x: window.scrollX, y: window.scrollY },
    };
  });
  if (measurement.viewportRect.width <= 0 || measurement.viewportRect.height <= 0) {
    throw new Error(`${label}: expected rendered geometry.`);
  }
  return { ...measurement, documentRect: documentRect(measurement) };
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
        // The runtime Select overlay can remain visible during its close
        // transition in the WC runtime and intercept pointer events meant for
        // the Thumb. Dismiss it before measuring or dragging.
        await page.keyboard.press('Escape');
        await page.waitForFunction(
          () =>
            !Array.from(
              document.querySelectorAll('[data-previewer-id] wc-shadcn-select-item')
            ).some(
              (item) =>
                item.getBoundingClientRect().width > 0 && item.getBoundingClientRect().height > 0
            ),
          undefined,
          { timeout: 10_000 }
        );
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

        const viewportBeforeFocus = await focusGeometry(
          viewport,
          `${runtime}/viewport-before-focus`
        );
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
          return {
            boxShadow: style.boxShadow,
            outlineWidth: style.outlineWidth,
            ringInset: style.getPropertyValue('--pui-ring-inset').trim(),
            ringWidth: style.getPropertyValue('--pui-ring-width').trim(),
          };
        });
        expect(focusPaint.boxShadow, `${runtime}/focus-ring`).not.toBe('none');
        expect(focusPaint.boxShadow, `${runtime}/focus-ring-inside-clip`).toContain('inset');
        expect(focusPaint.ringInset, `${runtime}/focus-ring-inset-token`).toBe('inset');
        expect(focusPaint.ringWidth, `${runtime}/focus-ring-width`).toBe('3px');
        expect(focusPaint.outlineWidth, `${runtime}/focus-outline`).toBe('1px');
        const viewportAfterFocus = await focusGeometry(viewport, `${runtime}/viewport-after-focus`);
        console.info(
          'Scroll Area focus geometry',
          JSON.stringify({ runtime, before: viewportBeforeFocus, after: viewportAfterFocus })
        );
        for (const property of ['x', 'y', 'width', 'height'] as const) {
          expectClose(
            viewportAfterFocus.documentRect[property],
            viewportBeforeFocus.documentRect[property],
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
            borderWidth: style.borderLeftWidth,
            borderColor: style.borderLeftColor,
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
          borderWidth: '1px',
          borderColor: 'rgba(0, 0, 0, 0)',
          flexDirection: 'row',
        });
        expect(horizontalStyle, `${runtime}/horizontal-style`).toEqual({
          position: 'absolute',
          height: '10px',
          bottom: '0px',
          left: '0px',
          borderWidth: '1px',
          borderColor: 'rgba(0, 0, 0, 0)',
          flexDirection: 'column',
        });
        expectClose(verticalBox.y, viewportBox.y, `${runtime}/vertical-top`);
        expectClose(
          verticalBox.x + verticalBox.width,
          viewportBox.x + viewportBox.width,
          `${runtime}/vertical-right`
        );
        expectClose(
          verticalBox.height + horizontalBox.height,
          viewportBox.height,
          `${runtime}/vertical-height`
        );
        expectClose(horizontalBox.x, viewportBox.x, `${runtime}/horizontal-left`);
        expectClose(
          horizontalBox.y + horizontalBox.height,
          viewportBox.y + viewportBox.height,
          `${runtime}/horizontal-bottom`
        );
        expectClose(
          horizontalBox.width + verticalBox.width,
          viewportBox.width,
          `${runtime}/horizontal-width`
        );
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
          // #1701 parks the composed thumb via top/left inside the track's content
          // box (a flex-1 minimum thumb stayed on flex-start and never met the
          // padded end), so the host now owns size with flex-grow:0, not flex:1.
          expect(paint.flexGrow, `${runtime}/${name}-thumb-flex`).toBe('0');
          expect(paint.borderRadius, `${runtime}/${name}-thumb-radius`).not.toBe('0px');
          expect(paint.backgroundColor, `${runtime}/${name}-thumb-fill`).not.toBe(
            'rgba(0, 0, 0, 0)'
          );
          expect(paint.role, `${runtime}/${name}-thumb-role`).toBeNull();
          expect(paint.tabIndex, `${runtime}/${name}-thumb-tabindex`).toBe(-1);
        }

        const verticalDrag = await thumbDragStart(
          page,
          verticalThumb,
          viewport,
          `${runtime}/vertical-thumb-start`
        );
        try {
          await page.mouse.down();
          await page.mouse.move(
            verticalDrag.box.x + verticalDrag.box.width / 2,
            verticalDrag.box.y + verticalDrag.box.height / 2 + 36,
            { steps: 4 }
          );
          await page.mouse.up();
          await expect
            .poll(() => viewport.evaluate((surface) => surface.scrollTop), { message: runtime })
            .toBeGreaterThan(0);
          expect(
            (await scrollFacts(viewport)).scrollTop,
            `${runtime}/vertical-drag-delta`
          ).toBeGreaterThan(verticalDrag.before.scrollTop);
        } finally {
          console.info(
            '[shadcn-scroll-thumb-drag-result]',
            JSON.stringify({
              runtime,
              axis: 'vertical',
              before: verticalDrag.before,
              after: await scrollFacts(viewport),
            })
          );
        }

        const horizontalDrag = await thumbDragStart(
          page,
          horizontalThumb,
          viewport,
          `${runtime}/horizontal-thumb-start`
        );
        try {
          await page.mouse.down();
          await page.mouse.move(
            horizontalDrag.box.x + horizontalDrag.box.width / 2 + 36,
            horizontalDrag.box.y + horizontalDrag.box.height / 2,
            { steps: 4 }
          );
          await page.mouse.up();
          await expect
            .poll(() => viewport.evaluate((surface) => surface.scrollLeft), { message: runtime })
            .toBeGreaterThan(0);
          expect(
            (await scrollFacts(viewport)).scrollLeft,
            `${runtime}/horizontal-drag-delta`
          ).toBeGreaterThan(horizontalDrag.before.scrollLeft);
        } finally {
          console.info(
            '[shadcn-scroll-thumb-drag-result]',
            JSON.stringify({
              runtime,
              axis: 'horizontal',
              before: horizontalDrag.before,
              after: await scrollFacts(viewport),
            })
          );
        }

        // Mutation controls follow the real drags, so they cannot become an
        // implicit remeasurement/recovery prerequisite for successful input.
        await checkZeroBasisCounterexample(verticalThumb, 'vertical', `${runtime}/vertical-thumb`);
        await checkZeroBasisCounterexample(
          horizontalThumb,
          'horizontal',
          `${runtime}/horizontal-thumb`
        );

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
