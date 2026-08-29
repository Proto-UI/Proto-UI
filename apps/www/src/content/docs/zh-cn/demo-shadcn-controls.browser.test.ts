// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const TEXTAREA_ROUTE = '/en/ui-libraries/shadcn/textarea/';
const CHECKBOX_ROUTE = '/en/ui-libraries/shadcn/checkbox/';

/** The demo order: unchecked, checked, mixed, disabled, and a focus target. */
const UNCHECKED = 0;
const CHECKED = 1;
const MIXED = 2;
const DISABLED = 3;
const FOCUS_TARGET = 4;
const CHECKBOX_COUNT = 5;

/** Upstream transitions exactly these two properties, at the Tailwind defaults. */
const TRANSITION_PROPERTY = 'color, box-shadow';
const TRANSITION_DURATION = '0.15s';
const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)';

type BoxPaint = {
  background: string;
  alpha: number;
  rootFocusable: boolean;
  focusableInside: number;
  glyphs: number;
};

/**
 * Reads each Checkbox box as it is actually painted. The theme emits oklch, so
 * the colour is resolved through a canvas rather than compared as a string.
 */
async function boxPaints(page: Page): Promise<BoxPaint[]> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

    const boxes = [...document.querySelectorAll('[data-previewer-id] [role="checkbox"]')];
    return boxes.map((box) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0,0,0,0)';
      context.fillStyle = getComputedStyle(box).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

      return {
        background: `${r},${g},${b}`,
        alpha: a / 255,
        // The Root is the only node the projection may put in tab order.
        rootFocusable: (box as HTMLElement).tabIndex >= 0,
        focusableInside: [...box.querySelectorAll('*')].filter(
          (node) => (node as HTMLElement).tabIndex >= 0
        ).length,
        glyphs: box.querySelectorAll('svg').length,
      };
    });
  });
}

/**
 * The Indicator glyph is a derived render, so it lands one turn after the Roots
 * that `selectRuntime` waits on. Measured settle after the Roots exist is 1ms in
 * Web Components, 3ms in Vue, and 10ms in React, which is why the wait is here
 * rather than in the shared readiness helper.
 */
async function waitForGlyphs(page: Page): Promise<void> {
  await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll('[data-previewer-id] [role="checkbox"]')]
        .map((box) => box.querySelectorAll('svg').length)
        .join(',') === expected,
    '0,1,1,1,0',
    { timeout: 10_000 }
  );
}

let browser: Browser;
let baseUrl = '';

type EditorStyle = {
  boxShadow: string;
  backgroundAlpha: number;
  transitionProperty: string;
  transitionDuration: string;
  transitionTimingFunction: string;
  focusProjected: boolean;
  focusVisibleProjected: boolean;
  nativeFocusVisible: boolean;
};

async function editorStyle(page: Page): Promise<EditorStyle> {
  return page.evaluate(() => {
    const editor = document.querySelector('[data-previewer-id] textarea');
    if (!editor) throw new Error('The shadcn Textarea demo must render a host-owned editor.');
    const style = getComputedStyle(editor);

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = 'rgba(0,0,0,0)';
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, 1, 1);

    return {
      boxShadow: style.boxShadow,
      backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3] / 255,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      transitionTimingFunction: style.transitionTimingFunction,
      focusProjected: editor.hasAttribute('data-focused'),
      focusVisibleProjected: editor.hasAttribute('data-focus-visible'),
      nativeFocusVisible: editor.matches(':focus-visible'),
    };
  });
}

async function focusEditorWithRealTab(page: Page): Promise<void> {
  const prepared = await page.evaluate(() => {
    const editor = document.querySelector<HTMLTextAreaElement>('[data-previewer-id] textarea');
    if (!editor) return false;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')
    ).filter((element) => {
      const style = getComputedStyle(element);
      return (
        !element.hasAttribute('disabled') &&
        element.tabIndex >= 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
    const index = candidates.indexOf(editor);
    if (index <= 0) return false;
    candidates[index - 1]!.focus();
    return document.activeElement === candidates[index - 1];
  });
  if (!prepared) throw new Error('Unable to prepare the real Tab predecessor for the Textarea.');
  await page.keyboard.press('Tab');
  const active = await page.evaluate(() => {
    const editor = document.querySelector('[data-previewer-id] textarea');
    return document.activeElement === editor;
  });
  if (!active) throw new Error('Real Tab traversal did not reach the Shadcn Textarea editor.');
}

/**
 * Waits until `boxShadow` reaches `expected`, and reports whether any sample
 * along the way sat between the two endpoints. Unlike a "two equal samples"
 * heuristic this cannot mistake a quantization pause or two not-yet-started
 * frames for completion, and it fails loudly instead of returning whatever
 * frame it happened to see last.
 */
async function runTransition(
  page: Page,
  from: string,
  expected: string,
  label: string
): Promise<{ sawIntermediate: boolean }> {
  let sawIntermediate = false;
  let last = '';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = (await editorStyle(page)).boxShadow;
    if (current !== from && current !== expected) sawIntermediate = true;
    if (current === expected && attempt > 0) return { sawIntermediate };
    last = current;
    await page.waitForTimeout(15);
  }
  throw new Error(`${label}: box-shadow never settled to the expected value.\nlast: ${last}`);
}

beforeAll(async () => {
  baseUrl = await startServer(TEXTAREA_ROUTE);
  browser = await launchBrowser();
}, 150_000);

// Two more cases mean two more contexts to close, and teardown outgrew the
// default 10s hook budget.
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('shadcn control documentation browser regressions', () => {
  it('transitions only colour and box-shadow at the upstream duration and easing', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, TEXTAREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      const mountScope = await previewer.evaluate((root) => ({
        previewerRoots: root.querySelectorAll('[data-pui-root]').length,
        demoRoots: root.querySelector('.host')?.querySelectorAll('[data-pui-root]').length ?? 0,
      }));
      expect(mountScope.previewerRoots).toBeGreaterThan(mountScope.demoRoots);
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-pui-root]', 3);
        await applyColorScheme(page, 'light');

        const resting = await editorStyle(page);
        // The property set is the whole point: `all` would also animate the
        // background, which upstream never transitions.
        expect(resting.transitionProperty, `${runtime}/property`).toBe(TRANSITION_PROPERTY);
        expect(resting.transitionDuration, `${runtime}/duration`).toBe(TRANSITION_DURATION);
        expect(resting.transitionTimingFunction, `${runtime}/timing`).toBe(TRANSITION_TIMING);
      }
    } finally {
      await context.close();
    }
  }, 180_000);

  it('animates the focus ring in and out wherever focus reaches the projection', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, TEXTAREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-pui-root]', 3);
        await applyColorScheme(page, 'light');

        const resting = await editorStyle(page);

        // Real click path: portable focusVisible must equal the physical host
        // result. Ring expectations are derived from that measurement.
        await previewer.locator('textarea').first().click();
        await page.waitForTimeout(400);
        const pointer = await editorStyle(page);
        expect(pointer.focusProjected, `${runtime}/pointer-focused`).toBe(true);
        expect(pointer.focusVisibleProjected, `${runtime}/pointer-equality`).toBe(
          pointer.nativeFocusVisible
        );
        if (pointer.nativeFocusVisible) {
          expect(pointer.boxShadow, `${runtime}/pointer-ring`).not.toBe(resting.boxShadow);
        } else {
          expect(pointer.boxShadow, `${runtime}/pointer-no-ring`).toBe(resting.boxShadow);
        }

        await page.mouse.click(5, 5);
        if (pointer.nativeFocusVisible) {
          const pointerLeaving = await runTransition(
            page,
            pointer.boxShadow,
            resting.boxShadow,
            `${runtime}/pointer-blur`
          );
          expect(pointerLeaving.sawIntermediate, `${runtime}/pointer-blur-animated`).toBe(true);
        }

        // Real keyboard path: Tab traversal must reach the editor, and the
        // projected state must again equal the current native target result.
        await focusEditorWithRealTab(page);
        const keyboard = await editorStyle(page);
        expect(keyboard.focusProjected, `${runtime}/keyboard-focused`).toBe(true);
        expect(keyboard.focusVisibleProjected, `${runtime}/keyboard-equality`).toBe(
          keyboard.nativeFocusVisible
        );
        if (keyboard.nativeFocusVisible) {
          expect(keyboard.boxShadow, `${runtime}/keyboard-ring`).not.toBe(resting.boxShadow);
        } else {
          expect(keyboard.boxShadow, `${runtime}/keyboard-no-ring`).toBe(resting.boxShadow);
        }

        await page.mouse.click(5, 5);
        await page.waitForTimeout(400);
        const keyboardBlurred = await editorStyle(page);
        expect(keyboardBlurred.focusProjected, `${runtime}/keyboard-blurred-focused`).toBe(false);
        expect(keyboardBlurred.focusVisibleProjected, `${runtime}/keyboard-blurred-visible`).toBe(
          false
        );
        expect(keyboardBlurred.boxShadow, `${runtime}/keyboard-blurred-ring`).toBe(
          resting.boxShadow
        );
      }
    } finally {
      await context.close();
    }
  }, 180_000);

  it('repaints the Textarea colorScheme surface across light-dark-light in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, TEXTAREA_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[data-pui-root]', 3);

        // The background is outside the transition set, so each read is the
        // settled value and no animation-aware waiting is needed here.
        await applyColorScheme(page, 'light');
        expect((await editorStyle(page)).backgroundAlpha, `${runtime}/light-before`).toBe(0);

        await applyColorScheme(page, 'dark');
        expect((await editorStyle(page)).backgroundAlpha, `${runtime}/dark`).toBeGreaterThan(0);

        await applyColorScheme(page, 'light');
        expect((await editorStyle(page)).backgroundAlpha, `${runtime}/light-after`).toBe(0);
      }
    } finally {
      await context.close();
    }
  }, 180_000);
  it('paints the dark tint on the unfilled box only, in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, CHECKBOX_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="checkbox"]', CHECKBOX_COUNT);

        await applyColorScheme(page, 'light');
        const light = await boxPaints(page);
        // The resting box declares no fill of its own in either scheme.
        expect(light[UNCHECKED].alpha, `${runtime}/light-resting`).toBe(0);
        expect(light[CHECKED].alpha, `${runtime}/light-checked`).toBeGreaterThan(0);
        expect(light[MIXED].background, `${runtime}/light-mixed`).toBe(light[CHECKED].background);

        await applyColorScheme(page, 'dark');
        const dark = await boxPaints(page);
        // The tint is what the guard keeps, so it has to be visible somewhere.
        expect(dark[UNCHECKED].alpha, `${runtime}/dark-resting`).toBeGreaterThan(0);
        // And it must not reach either filled box. Both carry the fill and the
        // tint as tokens, so only the resolved paint separates them.
        expect(dark[CHECKED].background, `${runtime}/dark-checked`).not.toBe(
          dark[UNCHECKED].background
        );
        expect(dark[MIXED].background, `${runtime}/dark-mixed`).toBe(dark[CHECKED].background);
        expect(dark[MIXED].alpha, `${runtime}/dark-mixed-alpha`).toBe(dark[CHECKED].alpha);

        await applyColorScheme(page, 'light');
        expect((await boxPaints(page))[UNCHECKED].alpha, `${runtime}/light-after`).toBe(0);
      }
    } finally {
      await context.close();
    }
  }, 180_000);

  it('gives each Checkbox one focusable control and keeps the glyph unnamed', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, CHECKBOX_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="checkbox"]', CHECKBOX_COUNT);
        await waitForGlyphs(page);

        const paints = await boxPaints(page);
        expect(paints, `${runtime}/count`).toHaveLength(CHECKBOX_COUNT);
        for (const [index, paint] of paints.entries()) {
          // The Indicator is presentational, so it must never join tab order.
          expect(paint.focusableInside, `${runtime}/inside-${index}`).toBe(0);
        }
        for (const index of [UNCHECKED, CHECKED, MIXED, FOCUS_TARGET]) {
          expect(paints[index].rootFocusable, `${runtime}/root-focusable-${index}`).toBe(true);
        }
        // Base takes a disabled checkbox out of tab order, and the projection
        // must not hand it back.
        expect(paints[DISABLED].rootFocusable, `${runtime}/disabled-focusable`).toBe(false);
        expect(paints[CHECKED].glyphs, `${runtime}/checked-glyph`).toBe(1);
        expect(paints[MIXED].glyphs, `${runtime}/mixed-glyph`).toBe(1);
        expect(paints[UNCHECKED].glyphs, `${runtime}/unchecked-glyph`).toBe(0);

        // The glyph hides its own root, so the checkbox is the only node the
        // accessibility tree reports for each instance.
        const boxes = previewer.getByRole('checkbox');
        for (let index = 0; index < CHECKBOX_COUNT; index += 1) {
          const snapshot = await boxes.nth(index).ariaSnapshot();
          expect(snapshot.match(/^\s*- /gm) ?? [], `${runtime}/aria-${index}`).toHaveLength(1);
          expect(snapshot, `${runtime}/aria-role-${index}`).toContain('checkbox');
        }
      }
    } finally {
      await context.close();
    }
  }, 180_000);
});
