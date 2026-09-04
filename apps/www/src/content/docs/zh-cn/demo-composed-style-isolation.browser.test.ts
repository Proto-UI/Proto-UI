// @vitest-environment node

import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  runtimeSelectTrigger,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

/** Brutalist puts a hard offset shadow on the thumb, which is what re-composed the ring. */
const BRUTALIST_SWITCH_ROUTE = '/en/ui-libraries/brutalist/components/switch/';
/** Shadcn scales the pressed root, which is what the thumb applied a second time. */
const SHADCN_SWITCH_ROUTE = '/en/ui-libraries/shadcn/switch/';

/** `data-[pressed]:scale-[0.98]` on the Shadcn Switch Root. */
const PRESSED_SCALE = 0.98;

let browser: Browser;
let baseUrl = '';

type ShadowLayer = {
  value: string;
  alpha: number;
};

type SwitchShadows = {
  focusVisible: boolean;
  root: ShadowLayer[];
  thumb: ShadowLayer[];
};

/**
 * Splits a computed `box-shadow` into its layers and resolves each layer's
 * colour through a canvas, because the themes emit oklch and no string
 * comparison can tell a painted layer from a transparent one.
 */
const READ_SWITCH_SHADOWS = () => {
  const root = document.querySelector<HTMLElement>('[data-previewer-id] [role="switch"]');
  if (!root) throw new Error('The Switch demo must render a Root.');
  const thumb = root.querySelector<HTMLElement>('[data-pui-style]');
  if (!thumb) throw new Error('The Switch demo must render a styled Thumb.');

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

  const layers = (element: HTMLElement) => {
    const shadow = getComputedStyle(element).boxShadow;
    if (shadow === 'none') return [];

    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of shadow) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    parts.push(current.trim());

    return parts.filter(Boolean).map((value) => {
      const color = value.match(
        /^(?:(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|#[0-9a-f]+|[a-z]+)/i
      );
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0,0,0,0)';
      context.fillStyle = color ? color[0] : 'rgba(0,0,0,0)';
      context.fillRect(0, 0, 1, 1);
      return { value, alpha: context.getImageData(0, 0, 1, 1).data[3] / 255 };
    });
  };

  return {
    focusVisible: root.hasAttribute('data-focus-visible'),
    root: layers(root),
    thumb: layers(thumb),
  };
};

async function switchShadows(page: Page): Promise<SwitchShadows> {
  return page.evaluate(READ_SWITCH_SHADOWS);
}

/** Real keyboard focus, so the ring comes from the host's own focus-visible determination. */
async function focusFirstSwitch(page: Page, previewer: Locator): Promise<void> {
  await runtimeSelectTrigger(previewer).focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-previewer-id] [role="switch"]')
        ?.hasAttribute('data-focus-visible') === true,
    undefined,
    { timeout: 10_000 }
  );
}

/** Horizontal scale factor of each element's own resolved transform. */
async function switchScales(page: Page): Promise<{ root: number; thumb: number }> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-previewer-id] [role="switch"]');
    if (!root) throw new Error('The Switch demo must render a Root.');
    const thumb = root.querySelector<HTMLElement>('[data-pui-style]');
    if (!thumb) throw new Error('The Switch demo must render a styled Thumb.');

    const scale = (element: HTMLElement) =>
      new DOMMatrixReadOnly(getComputedStyle(element).transform).a;

    return { root: scale(root), thumb: scale(thumb) };
  });
}

/**
 * Samples until two consecutive reads agree. The Root assertion that follows is
 * what makes a premature settle fail loudly rather than pass on a frame where
 * both elements are still at 1.
 */
async function settledScales(page: Page): Promise<{ root: number; thumb: number }> {
  let last = await switchScales(page);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.waitForTimeout(20);
    const next = await switchScales(page);
    if (next.root === last.root && next.thumb === last.thumb) return next;
    last = next;
  }
  throw new Error('The Switch transform never settled.');
}

function paintedLayers(layers: ShadowLayer[]): ShadowLayer[] {
  return layers.filter((layer) => layer.alpha > 0);
}

beforeAll(async () => {
  baseUrl = await startServer(BRUTALIST_SWITCH_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('composed style isolation browser regressions', () => {
  it('paints the focus ring on the focused Switch and not on its thumb', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, BRUTALIST_SWITCH_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="switch"]', 3);
        for (const scheme of COLOR_SCHEMES) {
          await applyColorScheme(page, scheme);
          await focusFirstSwitch(page, previewer);

          const shadows = await switchShadows(page);
          const label = `${runtime}/${scheme}`;
          expect(shadows.focusVisible, `${label}/focus-visible`).toBe(true);

          // The focused element keeps its ring: the offset layer, the ring
          // itself, and the Brutalist hard shadow.
          expect(paintedLayers(shadows.root), `${label}/root-layers`).toHaveLength(3);

          // The Thumb declares one shadow token and no ring, so one painted
          // layer is all it may have. Anything more is an inherited ring.
          expect(paintedLayers(shadows.thumb), `${label}/thumb-layers`).toHaveLength(1);
          expect(paintedLayers(shadows.thumb)[0].value, `${label}/thumb-own-shadow`).toBe(
            paintedLayers(shadows.root)[2].value
          );
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('scales the pressed Switch once, not again on its thumb', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, SHADCN_SWITCH_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="switch"]', 3);
        await applyColorScheme(page, 'light');

        const resting = await switchScales(page);
        expect(resting.root, `${runtime}/resting-root`).toBeCloseTo(1, 3);
        expect(resting.thumb, `${runtime}/resting-thumb`).toBeCloseTo(1, 3);

        const box = await previewer.getByRole('switch').first().boundingBox();
        if (!box) throw new Error('The Switch Root must be laid out.');

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();

        try {
          // The Root transitions into the pressed scale over 200ms. Sampling on
          // the attribute alone catches both elements still at 1, where the
          // comparison below would hold for either behaviour, so wait until the
          // transition has actually moved the Root before settling on it.
          await page.waitForFunction(
            () => {
              const root = document.querySelector<HTMLElement>(
                '[data-previewer-id] [role="switch"]'
              );
              if (!root?.hasAttribute('data-pressed')) return false;
              return new DOMMatrixReadOnly(getComputedStyle(root).transform).a < 0.999;
            },
            undefined,
            { timeout: 10_000 }
          );

          const pressed = await settledScales(page);
          expect(pressed.root, `${runtime}/pressed-root`).toBeCloseTo(PRESSED_SCALE, 3);
          // The Root transform already scales its subtree, so a Thumb that also
          // scales lands the same factor twice.
          expect(pressed.thumb, `${runtime}/pressed-thumb`).toBeCloseTo(1, 3);
        } finally {
          await page.mouse.up();
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
