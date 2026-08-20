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

/** Upstream transitions exactly these two properties, at the Tailwind defaults. */
const TRANSITION_PROPERTY = 'color, box-shadow';
const TRANSITION_DURATION = '0.15s';
const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)';

let browser: Browser;
let baseUrl = '';

type EditorStyle = {
  boxShadow: string;
  backgroundAlpha: number;
  transitionProperty: string;
  transitionDuration: string;
  transitionTimingFunction: string;
  focusProjected: boolean;
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
      nativeFocusVisible: editor.matches(':focus-visible'),
    };
  });
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

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe.sequential('shadcn control documentation browser regressions', () => {
  it('transitions only colour and box-shadow at the upstream duration and easing', async () => {
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
        await previewer.locator('textarea').first().click();
        await page.waitForTimeout(400);
        const focused = await editorStyle(page);

        // A text control matches :focus-visible on pointer focus in this host,
        // which is what upstream keys the ring on. Whether every UA agrees is
        // the host's call, so the assertion reads the host rather than assuming.
        expect(focused.nativeFocusVisible, `${runtime}/native`).toBe(true);

        if (!focused.focusProjected) {
          // Web Components does not project text-control focus onto the host
          // yet, so no ring can paint. That gap is #395, fixed by #426; this
          // case starts covering wc automatically once that lands.
          expect(focused.boxShadow, `${runtime}/unprojected`).toBe(resting.boxShadow);
          continue;
        }

        expect(focused.boxShadow, `${runtime}/focused`).not.toBe(resting.boxShadow);

        // Re-run both directions and require a frame strictly between the two
        // endpoints, which is what distinguishes an animation from a jump.
        await page.mouse.click(5, 5);
        const leaving = await runTransition(
          page,
          focused.boxShadow,
          resting.boxShadow,
          `${runtime}/blur`
        );
        expect(leaving.sawIntermediate, `${runtime}/blur-animated`).toBe(true);

        await previewer.locator('textarea').first().click();
        const entering = await runTransition(
          page,
          resting.boxShadow,
          focused.boxShadow,
          `${runtime}/focus`
        );
        expect(entering.sawIntermediate, `${runtime}/focus-animated`).toBe(true);
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
});
