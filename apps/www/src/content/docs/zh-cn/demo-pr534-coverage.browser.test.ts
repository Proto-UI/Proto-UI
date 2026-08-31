// @vitest-environment node

import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const SCROLL_AREA_ROUTE = '/zh-cn/ui-libraries/shadcn/scroll-area/';
const TOOLTIP_ROUTE = '/zh-cn/ui-libraries/shadcn/tooltip/';
const CHECKBOX_ROUTE = '/zh-cn/ui-libraries/brutalist/components/checkbox/';

const NARROW_WIDTH = 320;
const GEOMETRY_EPSILON = 0.5;
const MIN_NON_TEXT_CONTRAST = 3;
const EVIDENCE_DIRECTORY = resolve(process.cwd(), '.codex', 'pr534-browser-evidence');
const requestedRuntime = process.env.PROTO_UI_PR534_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_PR534_BROWSER_RUNTIME must be one of ${RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

type ElementGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};


async function geometry(locator: Locator, label: string): Promise<ElementGeometry> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: expected visible rendered geometry.`);
  return box;
}

function expectStableGeometry(
  before: ElementGeometry,
  after: ElementGeometry,
  label: string
): void {
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(after[property] - before[property]),
      `${label}/${property}`
    ).toBeLessThanOrEqual(GEOMETRY_EPSILON);
  }
}

async function expectNarrowLayout(
  page: Page,
  label: string,
  surfaces: readonly Locator[]
): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    ),
    `${label}/document-overflow`
  ).toBe(0);

  for (const [index, surface] of surfaces.entries()) {
    const box = await geometry(surface, `${label}/surface-${index}`);
    expect(box.x, `${label}/surface-${index}/left`).toBeGreaterThanOrEqual(-GEOMETRY_EPSILON);
    expect(box.x + box.width, `${label}/surface-${index}/right`).toBeLessThanOrEqual(
      NARROW_WIDTH + GEOMETRY_EPSILON
    );
  }
}

async function expectPublicPreviewerControls(previewer: Locator, label: string): Promise<void> {
  const publicRuntimes = await previewer
    .locator('[data-adapter-select-root] wc-shadcn-select-item')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-value')));
  expect(publicRuntimes, `${label}/public-runtimes`).toEqual([...RUNTIMES]);
  expect(await previewer.locator('[data-code-shell]').count(), `${label}/empty-code-panel`).toBe(0);
}

async function changedPixelCount(before: Buffer, after: Buffer): Promise<number> {
  const first = await sharp(before).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const second = await sharp(after).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  expect(second.info.width, 'pixel-evidence/width').toBe(first.info.width);
  expect(second.info.height, 'pixel-evidence/height').toBe(first.info.height);
  expect(second.info.channels, 'pixel-evidence/channels').toBe(first.info.channels);

  let changed = 0;
  for (let offset = 0; offset < first.data.length; offset += first.info.channels) {
    let pixelChanged = false;
    for (let channel = 0; channel < first.info.channels; channel += 1) {
      if (Math.abs(first.data[offset + channel] - second.data[offset + channel]) > 8) {
        pixelChanged = true;
        break;
      }
    }
    if (pixelChanged) changed += 1;
  }
  return changed;
}

function evidencePath(
  runtime: (typeof RUNTIMES)[number],
  colorScheme: (typeof COLOR_SCHEMES)[number],
  frame: string
): string {
  return join(EVIDENCE_DIRECTORY, `brutalist-checkbox-${runtime}-${colorScheme}-${frame}.png`);
}

async function foregroundBackgroundContrast(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const paint = (value: string): [number, number, number] => {
      const channels = value
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      if (!channels || channels.length !== 3) throw new Error(`Unsupported CSS color: ${value}`);
      return channels as [number, number, number];
    };
    const luminance = ([red, green, blue]: [number, number, number]): number => {
      const linear = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const style = getComputedStyle(element);
    const foreground = luminance(paint(style.color));
    const background = luminance(paint(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  baseUrl = await startServer(SCROLL_AREA_ROUTE);
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('PR #534 coverage-matrix browser acceptance', () => {
  it('mounts shadcn Scroll Area with one native two-axis surface in every runtime', async () => {
    const { context, page, previewer, runtimeErrors } = await openRoute(
      browser,
      baseUrl,
      SCROLL_AREA_ROUTE,
      {
        width: NARROW_WIDTH,
        height: 844,

      }
    );

    try {
      await previewer.scrollIntoViewIfNeeded();
      await expectPublicPreviewerControls(previewer, 'scroll-area');
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="scrollViewport"]', 1);

        const viewport = previewer.locator('[data-demo-ref="scrollViewport"]');
        const root = viewport.locator('xpath=..');
        const verticalScrollbar = previewer.locator('[data-demo-ref="verticalScrollbar"]');
        const horizontalScrollbar = previewer.locator('[data-demo-ref="horizontalScrollbar"]');
        const verticalThumb = previewer.locator('[data-demo-ref="verticalThumb"]');
        const horizontalThumb = previewer.locator('[data-demo-ref="horizontalThumb"]');

        await page.waitForFunction(
          () => {
            const surface = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="scrollViewport"]'
            );
            return (
              !!surface &&
              surface.clientWidth > 0 &&
              surface.clientHeight > 0 &&
              surface.scrollWidth > surface.clientWidth &&
              surface.scrollHeight > surface.clientHeight &&
              surface.hasAttribute('data-scroll-horizontal-can-scroll-after') &&
              surface.hasAttribute('data-scroll-vertical-can-scroll-after')
            );
          },
          undefined,
          { timeout: 20_000 }
        );

        const initial = await viewport.evaluate((surface) => ({
          tabIndex: surface.getAttribute('tabindex'),
          role: surface.getAttribute('role'),
          axes: surface.getAttribute('data-scroll-axes'),
          projection: surface.getAttribute('data-pui-scroll-projection'),
          clientWidth: surface.clientWidth,
          clientHeight: surface.clientHeight,
          scrollWidth: surface.scrollWidth,
          scrollHeight: surface.scrollHeight,
          scrollLeft: surface.scrollLeft,
          scrollTop: surface.scrollTop,
        }));

        expect(initial.tabIndex, `${runtime}/viewport-tabindex`).toBe('0');
        expect(initial.role, `${runtime}/viewport-role`).toBeNull();
        expect(initial.axes, `${runtime}/viewport-axes`).toBe('both');
        expect(initial.projection, `${runtime}/viewport-projection`).toBe('composed');
        expect(initial.scrollWidth, `${runtime}/horizontal-overflow`).toBeGreaterThan(
          initial.clientWidth
        );
        expect(initial.scrollHeight, `${runtime}/vertical-overflow`).toBeGreaterThan(
          initial.clientHeight
        );
        expect(initial.scrollLeft, `${runtime}/initial-left`).toBe(0);
        expect(initial.scrollTop, `${runtime}/initial-top`).toBe(0);
        expect(await verticalScrollbar.getAttribute('data-orientation'), runtime).toBe('vertical');
        expect(await horizontalScrollbar.getAttribute('data-orientation'), runtime).toBe(
          'horizontal'
        );

        const rootBox = await geometry(root, `${runtime}/root`);
        const verticalTrackBox = await geometry(verticalScrollbar, `${runtime}/vertical-track`);
        const horizontalTrackBox = await geometry(
          horizontalScrollbar,
          `${runtime}/horizontal-track`
        );
        const verticalThumbBox = await geometry(verticalThumb, `${runtime}/vertical-thumb`);
        const horizontalThumbBox = await geometry(horizontalThumb, `${runtime}/horizontal-thumb`);
        expect(
          rootBox.height - verticalTrackBox.height,
          `${runtime}/vertical-track-inset`
        ).toBeGreaterThanOrEqual(0);
        expect(
          rootBox.height - verticalTrackBox.height,
          `${runtime}/vertical-track-inset`
        ).toBeLessThanOrEqual(4);
        expect(
          rootBox.width - horizontalTrackBox.width,
          `${runtime}/horizontal-track-inset`
        ).toBeGreaterThanOrEqual(0);
        expect(
          rootBox.width - horizontalTrackBox.width,
          `${runtime}/horizontal-track-inset`
        ).toBeLessThanOrEqual(4);
        expect(verticalThumbBox.height, `${runtime}/vertical-thumb-ratio`).toBeLessThan(
          verticalTrackBox.height
        );
        expect(horizontalThumbBox.width, `${runtime}/horizontal-thumb-ratio`).toBeLessThan(
          horizontalTrackBox.width
        );

        await verticalThumb.hover();
        const verticalDragStart = await geometry(verticalThumb, `${runtime}/vertical-drag-start`);
        await page.mouse.down();
        await page.mouse.move(
          verticalDragStart.x + verticalDragStart.width / 2,
          verticalDragStart.y + verticalDragStart.height / 2 + 36,
          { steps: 4 }
        );
        await page.mouse.up();
        await page.waitForFunction(
          () =>
            (document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="scrollViewport"]'
            )?.scrollTop ?? 0) > 0,
          undefined,
          { timeout: 10_000 }
        );

        await horizontalThumb.hover();
        const horizontalDragStart = await geometry(
          horizontalThumb,
          `${runtime}/horizontal-drag-start`
        );
        await page.mouse.down();
        await page.mouse.move(
          horizontalDragStart.x + horizontalDragStart.width / 2 + 36,
          horizontalDragStart.y + horizontalDragStart.height / 2,
          { steps: 4 }
        );
        await page.mouse.up();
        try {
          await page.waitForFunction(
            () => {
              const surface = document.querySelector<HTMLElement>(
                '[data-previewer-id] [data-demo-ref="scrollViewport"]'
              );
              const vertical = document.querySelector<HTMLElement>(
                '[data-previewer-id] [data-demo-ref="verticalThumb"]'
              );
              const horizontal = document.querySelector<HTMLElement>(
                '[data-previewer-id] [data-demo-ref="horizontalThumb"]'
              );
              return (
                !!surface &&
                !!vertical &&
                !!horizontal &&
                surface.scrollLeft > 0 &&
                surface.scrollTop > 0 &&
                surface.hasAttribute('data-scroll-horizontal-can-scroll-before') &&
                surface.hasAttribute('data-scroll-vertical-can-scroll-before') &&
                Number.parseFloat(
                  vertical.style.getPropertyValue('--proto-ui-scroll-thumb-offset')
                ) > 0 &&
                Number.parseFloat(
                  horizontal.style.getPropertyValue('--proto-ui-scroll-thumb-offset')
                ) > 0
              );
            },
            undefined,
            { timeout: 20_000 }
          );
        } catch (error) {
          const diagnostics = await page.evaluate(() => {
            const surface = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="scrollViewport"]'
            );
            const vertical = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="verticalThumb"]'
            );
            const horizontal = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="horizontalThumb"]'
            );
            return {
              scrollLeft: surface?.scrollLeft,
              scrollTop: surface?.scrollTop,
              horizontalBefore: surface?.hasAttribute('data-scroll-horizontal-can-scroll-before'),
              verticalBefore: surface?.hasAttribute('data-scroll-vertical-can-scroll-before'),
              verticalOffset: vertical?.style.getPropertyValue('--proto-ui-scroll-thumb-offset'),
              horizontalOffset: horizontal?.style.getPropertyValue(
                '--proto-ui-scroll-thumb-offset'
              ),
            };
          });
          throw new Error(`${runtime}/composed-drag diagnostics: ${JSON.stringify(diagnostics)}`, {
            cause: error,
          });
        }

        await expectNarrowLayout(page, runtime, [
          root,
          viewport,
          verticalScrollbar,
          horizontalScrollbar,
        ]);
        expect(runtimeErrors, `${runtime}/runtime-errors`).toEqual([]);
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('mounts shadcn Tooltip with focus ARIA, portal presence, and Escape dismissal', async () => {
    const { context, page, previewer, runtimeErrors } = await openRoute(
      browser,
      baseUrl,
      TOOLTIP_ROUTE,
      {
        width: NARROW_WIDTH,
        height: 844,

      }
    );

    try {
      await previewer.scrollIntoViewIfNeeded();
      await expectPublicPreviewerControls(previewer, 'tooltip');
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="accountTrigger"]', 1);

        const triggers = previewer.locator(
          '[data-demo-ref="accountTrigger"], [data-demo-ref="notificationsTrigger"]'
        );
        const account = previewer.locator('[data-demo-ref="accountTrigger"]');
        const notifications = previewer.locator('[data-demo-ref="notificationsTrigger"]');

        expect(await triggers.count(), `${runtime}/trigger-count`).toBe(2);
        expect(await account.getAttribute('tabindex'), `${runtime}/account-tabindex`).toBe('0');
        expect(
          await notifications.getAttribute('tabindex'),
          `${runtime}/notifications-tabindex`
        ).toBe('0');
        expect(
          await account.getAttribute('aria-describedby'),
          `${runtime}/closed-description`
        ).toBeNull();
        expect(await page.locator('[role="tooltip"]').count(), `${runtime}/closed-content`).toBe(0);

        await account.focus();
        await page.waitForFunction(
          () => {
            const trigger = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="accountTrigger"]'
            );
            const ids = trigger?.getAttribute('aria-describedby')?.trim().split(/\s+/) ?? [];
            return ids.some(
              (id) => document.getElementById(id)?.getAttribute('role') === 'tooltip'
            );
          },
          undefined,
          { timeout: 10_000 }
        );

        const describedBy = await account.getAttribute('aria-describedby');
        const tooltipId = describedBy
          ?.trim()
          .split(/\s+/)
          .find((id) => id.length > 0);
        if (!tooltipId) throw new Error(`${runtime}: focused Trigger did not expose a Tooltip id.`);
        const content = page.locator(`[id="${tooltipId}"]`);
        expect(await content.getAttribute('role'), `${runtime}/content-role`).toBe('tooltip');
        expect(await content.textContent(), `${runtime}/content-text`).toContain(
          'Open account settings.'
        );
        expect(await content.getAttribute('tabindex'), `${runtime}/content-tabindex`).toBeNull();
        expect(
          await content.locator('a, button, input, select, textarea, [tabindex]').count(),
          `${runtime}/content-focusables`
        ).toBe(0);
        expect(await content.isVisible(), `${runtime}/content-visible`).toBe(true);
        expect(await account.getAttribute('data-focused'), `${runtime}/trigger-focused`).toBe('');

        await expectNarrowLayout(page, runtime, [account, notifications, content]);

        await page.keyboard.press('Escape');
        await page.waitForFunction(
          () => {
            const trigger = document.querySelector<HTMLElement>(
              '[data-previewer-id] [data-demo-ref="accountTrigger"]'
            );
            return (
              !trigger?.hasAttribute('aria-describedby') &&
              document.querySelectorAll('[role="tooltip"][data-is-present]').length === 0
            );
          },
          undefined,
          { timeout: 10_000 }
        );
        expect(await page.locator('[role="tooltip"]:visible').count(), runtime).toBe(0);
        expect(
          await account.evaluate(
            (trigger) =>
              document.activeElement === trigger || trigger.contains(document.activeElement)
          ),
          `${runtime}/focus-retained`
        ).toBe(true);
        expect(runtimeErrors, `${runtime}/runtime-errors`).toEqual([]);
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('mounts Brutalist Checkbox state and records Light/Dark pointer frame sequences', async () => {
    const { context, page, previewer, runtimeErrors } = await openRoute(
      browser,
      baseUrl,
      CHECKBOX_ROUTE,
      {
        width: NARROW_WIDTH,
        height: 844,

      }
    );

    try {
      await previewer.scrollIntoViewIfNeeded();
      await expectPublicPreviewerControls(previewer, 'checkbox');
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="checkbox"]', 6);
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('[data-previewer-id] [role="checkbox"]')]
              .map((checkbox) => checkbox.querySelectorAll('svg').length)
              .join(',') === '0,1,1,1,0,1',
          undefined,
          { timeout: 10_000 }
        );

        const checkboxes = previewer.locator('[role="checkbox"]');
        expect(await checkboxes.count(), `${runtime}/checkbox-count`).toBe(6);
        const facts = await checkboxes.evaluateAll((roots) =>
          roots.map((root) => {
            const indicator = root.querySelector<HTMLElement>(':scope > [data-pui-root]');
            return {
              checked: root.getAttribute('aria-checked'),
              disabled: root.getAttribute('aria-disabled'),
              tabIndex: (root as HTMLElement).tabIndex,
              rootChecked: root.hasAttribute('data-checked'),
              rootIndeterminate: root.hasAttribute('data-indeterminate'),
              rootDisabled: root.hasAttribute('data-disabled'),
              indicatorRole: indicator?.getAttribute('role') ?? null,
              focusableInside: [...root.querySelectorAll<HTMLElement>('*')].filter(
                (element) => element.tabIndex >= 0
              ).length,
              svgCount: indicator?.querySelectorAll('svg').length ?? 0,
              glyphPath: indicator?.querySelector('svg path')?.getAttribute('d') ?? null,
            };
          })
        );

        expect(
          facts.map((fact) => fact.checked),
          `${runtime}/aria-checked`
        ).toEqual(['false', 'true', 'mixed', 'true', 'false', 'mixed']);
        expect(
          facts.map((fact) => fact.disabled),
          `${runtime}/aria-disabled`
        ).toEqual(['false', 'false', 'false', 'true', 'false', 'false']);
        expect(
          facts.map((fact) => fact.tabIndex),
          `${runtime}/tab-order`
        ).toEqual([0, 0, 0, -1, 0, 0]);
        expect(facts[0].rootChecked, `${runtime}/unchecked-state`).toBe(false);
        expect(facts[1].rootChecked, `${runtime}/checked-state`).toBe(true);
        expect(facts[2].rootIndeterminate, `${runtime}/mixed-state`).toBe(true);
        expect(facts[3].rootDisabled, `${runtime}/disabled-state`).toBe(true);
        expect(facts[5].rootChecked, `${runtime}/precedence-checked-state`).toBe(true);
        expect(facts[5].rootIndeterminate, `${runtime}/precedence-mixed-state`).toBe(true);
        for (const [index, fact] of facts.entries()) {
          expect(fact.indicatorRole, `${runtime}/indicator-role-${index}`).toBeNull();
          expect(fact.focusableInside, `${runtime}/nested-tabstop-${index}`).toBe(0);
        }
        expect(
          facts.map((fact) => fact.svgCount),
          `${runtime}/indicator-glyphs`
        ).toEqual([0, 1, 1, 1, 0, 1]);
        expect(facts[5].glyphPath, `${runtime}/precedence-glyph`).toBe('M5 12h14');

        const checkbox = checkboxes.first();
        const row = checkbox.locator('xpath=..');
        const mixedCheckbox = checkboxes.nth(2);
        const mixedRow = mixedCheckbox.locator('xpath=..');
        await row.scrollIntoViewIfNeeded();
        for (const colorScheme of COLOR_SCHEMES) {
          const label = `${runtime}/${colorScheme}`;
          await applyColorScheme(page, colorScheme);

          expect(await mixedCheckbox.getAttribute('aria-checked'), `${label}/mixed-aria`).toBe(
            'mixed'
          );
          expect(
            await mixedCheckbox.locator('svg path').getAttribute('d'),
            `${label}/mixed-glyph`
          ).toBe('M5 12h14');
          expect(
            await foregroundBackgroundContrast(mixedCheckbox),
            `${label}/mixed-glyph-contrast`
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          await mixedRow.screenshot({
            path: evidencePath(runtime, colorScheme, 'mixed'),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
          });

          if ((await checkbox.getAttribute('aria-checked')) !== 'false') {
            await checkbox.click();
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-previewer-id] [role="checkbox"]')
                  ?.getAttribute('aria-checked') === 'false',
              undefined,
              { timeout: 10_000 }
            );
          }

          await page.keyboard.press('Tab');
          await checkbox.focus();
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-previewer-id] [role="checkbox"]')
                ?.hasAttribute('data-focus-visible') === true,
            undefined,
            { timeout: 10_000 }
          );
          const focusShadow = await checkbox.evaluate(
            (element) => getComputedStyle(element).boxShadow
          );
          expect(focusShadow, `${label}/focus-visible-shadow`).not.toBe('none');
          await checkbox.evaluate((element) => (element as HTMLElement).blur());
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-previewer-id] [role="checkbox"]')
                ?.hasAttribute('data-focus-visible') === false,
            undefined,
            { timeout: 10_000 }
          );

          const beforeGeometry = await geometry(checkbox, `${label}/before-geometry`);
          const beforeShadow = await checkbox.evaluate(
            (element) => getComputedStyle(element).boxShadow
          );
          expect(beforeShadow, `${label}/before-shadow`).not.toBe('none');
          const beforeFrame = await row.screenshot({
            path: evidencePath(runtime, colorScheme, 'before'),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
          });

          const pointerTarget = await geometry(checkbox, `${label}/pointer-target`);
          await page.mouse.move(
            pointerTarget.x + pointerTarget.width / 2,
            pointerTarget.y + pointerTarget.height / 2
          );
          await page.mouse.down();
          let pressedFrame: Buffer;
          try {
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-previewer-id] [role="checkbox"]')
                  ?.hasAttribute('data-pressed') === true,
              undefined,
              { timeout: 10_000 }
            );
            const pressedGeometry = await geometry(checkbox, `${label}/pressed-geometry`);
            expectStableGeometry(beforeGeometry, pressedGeometry, `${label}/pressed-geometry`);
            const pressedShadow = await checkbox.evaluate(
              (element) => getComputedStyle(element).boxShadow
            );
            expect(pressedShadow, `${label}/pressed-shadow-change`).not.toBe(beforeShadow);
            pressedFrame = await row.screenshot({
              path: evidencePath(runtime, colorScheme, 'pressed'),
              animations: 'disabled',
              caret: 'hide',
              scale: 'css',
            });
          } finally {
            await page.mouse.up();
          }

          await page.waitForFunction(
            () => {
              const checkbox = document.querySelector('[data-previewer-id] [role="checkbox"]');
              return (
                checkbox?.getAttribute('aria-checked') === 'true' &&
                checkbox.hasAttribute('data-checked') &&
                !checkbox.hasAttribute('data-pressed') &&
                checkbox.querySelectorAll('svg').length === 1
              );
            },
            undefined,
            { timeout: 10_000 }
          );
          const settledGeometry = await geometry(checkbox, `${label}/settled-geometry`);
          expectStableGeometry(beforeGeometry, settledGeometry, `${label}/settled-geometry`);
          const settledFrame = await row.screenshot({
            path: evidencePath(runtime, colorScheme, 'settled'),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
          });

          expect(
            await changedPixelCount(beforeFrame, pressedFrame!),
            `${label}/before-to-pressed-pixels`
          ).toBeGreaterThan(4);
          expect(
            await changedPixelCount(pressedFrame!, settledFrame),
            `${label}/pressed-to-settled-pixels`
          ).toBeGreaterThan(4);
          expect(
            await foregroundBackgroundContrast(checkbox),
            `${label}/checked-glyph-contrast`
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(await checkbox.getAttribute('aria-checked'), `${label}/settled-aria`).toBe('true');
          expect(
            await checkbox.locator('svg path').getAttribute('d'),
            `${label}/settled-glyph`
          ).toBe('m20 6-11 11-5-5');

          await expectNarrowLayout(page, label, [
            row,
            ...Array.from({ length: 6 }, (_, index) => checkboxes.nth(index)),
          ]);
          expect(runtimeErrors, `${label}/runtime-errors`).toEqual([]);
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
