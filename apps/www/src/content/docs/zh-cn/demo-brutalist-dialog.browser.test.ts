// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const DIALOG_ROUTE = '/en/ui-libraries/brutalist/components/dialog/';

const VIEWPORT = { width: 1280, height: 900 } as const;

/** A second viewport, so a panel centred once cannot pass by standing still. */
const RESIZED_VIEWPORT = { width: 900, height: 640 } as const;

/** Half a device pixel: a centred panel may land on a subpixel boundary. */
const GEOMETRY_EPSILON = 0.5;

/** `BRUTALIST_PANEL_TOKENS` carries `shadow-[3px_3px_0_0_#000]`. */
const HARD_PANEL_SHADOW = 'rgb(0, 0, 0) 3px 3px 0px 0px';

/** The mask and the content, both portalled out of the demo host. */
const PRESENT_ROOT_COUNT = 2;

type OverlayGeometry = {
  viewport: { width: number; height: number };
  mask: {
    rect: { x: number; y: number; width: number; height: number };
    backdropFilter: string;
    boxShadow: string;
    borderTopWidth: string;
    zIndex: number;
  };
  content: {
    rect: { x: number; y: number; width: number; height: number };
    boxShadow: string;
    borderRadius: string;
    zIndex: number;
  };
  presentRoots: number;
  centreHitInsideContent: boolean;
};

let browser: Browser;
let baseUrl = '';

/**
 * The mask and the content are the only prototype roots the open Dialog holds
 * present in the document body, and the content carries the dialog role.
 *
 * Presence rather than membership: Vue 2 keeps a closed Dialog's portalled
 * nodes in the body and they outlive the app that mounted them, so a body
 * child count reads a previous runtime's residue as this runtime's overlay.
 */
async function readOverlayGeometry(page: Page): Promise<OverlayGeometry> {
  return page.evaluate(() => {
    const roots = Array.from(document.body.children).filter(
      (element) => element.hasAttribute('data-pui-root') && element.hasAttribute('data-is-present')
    );
    const content = roots.find((element) => element.getAttribute('role') === 'dialog');
    const mask = roots.find((element) => element !== content);
    if (!content || !mask) throw new Error('The open Dialog portalled no mask/content pair.');

    const measure = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const maskStyle = getComputedStyle(mask);
    const contentStyle = getComputedStyle(content);
    const contentRect = measure(content);
    const hit = document.elementFromPoint(
      contentRect.x + contentRect.width / 2,
      contentRect.y + contentRect.height / 2
    );

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      mask: {
        rect: measure(mask),
        backdropFilter: maskStyle.backdropFilter,
        boxShadow: maskStyle.boxShadow,
        borderTopWidth: maskStyle.borderTopWidth,
        zIndex: Number(maskStyle.zIndex),
      },
      content: {
        rect: contentRect,
        boxShadow: contentStyle.boxShadow,
        borderRadius: contentStyle.borderRadius,
        zIndex: Number(contentStyle.zIndex),
      },
      presentRoots: roots.length,
      centreHitInsideContent: Boolean(hit && content.contains(hit)),
    };
  });
}

function expectNear(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(GEOMETRY_EPSILON);
}

/** The panel is centred by transform, so the centres are what must agree. */
function expectCentred(geometry: OverlayGeometry, label: string): void {
  const { rect } = geometry.content;
  expectNear(rect.x + rect.width / 2, geometry.viewport.width / 2, `${label}/centre-x`);
  expectNear(rect.y + rect.height / 2, geometry.viewport.height / 2, `${label}/centre-y`);
}

async function openDialog(page: Page): Promise<void> {
  const trigger = page.locator('[data-previewer-id] [aria-haspopup="dialog"]').first();
  const contentId = await trigger.getAttribute('aria-controls');
  expect(contentId, 'trigger names its content').toBeTruthy();
  await trigger.click();
  // The panel animates in; a measurement taken mid-transition reads the
  // zoom-in-95 scale rather than the resting geometry the criterion states.
  await page.waitForFunction(
    (id) => {
      const content = id ? document.getElementById(id) : null;
      return Boolean(content && content.dataset.transitionState === 'entered');
    },
    contentId,
    { timeout: 20_000 }
  );
}

async function closeDialog(page: Page): Promise<void> {
  await page
    .locator(
      'body > [data-pui-root][role="dialog"][data-is-present] [data-pui-a11y-actions="activate"]'
    )
    .first()
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll('body > [data-pui-root][data-is-present]').length === 0,
    undefined,
    { timeout: 20_000 }
  );
}

describe('Brutalist Dialog overlay geometry', () => {
  beforeAll(async () => {
    baseUrl = await startServer(DIALOG_ROUTE);
    browser = await launchBrowser();
  }, 240_000);

  afterAll(async () => {
    await browser?.close();
    await stopServer();
  });

  it('covers the viewport and centres the hard-shadowed panel in all runtimes', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, DIALOG_ROUTE, VIEWPORT);

    try {
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[aria-haspopup="dialog"]', 1);
        await page.setViewportSize({ ...VIEWPORT });
        await openDialog(page);

        const geometry = await readOverlayGeometry(page);
        // The module test reads the token string. Everything below is what the
        // token string is supposed to produce, and happy-dom lays out nothing.
        expect(geometry.presentRoots, `${runtime}/present-roots`).toBe(PRESENT_ROOT_COUNT);

        // P-BRUTALIST-DIALOG-MASK-VISUAL-GRAMMAR: a flat scrim over the viewport.
        expectNear(geometry.mask.rect.x, 0, `${runtime}/mask-x`);
        expectNear(geometry.mask.rect.y, 0, `${runtime}/mask-y`);
        expectNear(geometry.mask.rect.width, geometry.viewport.width, `${runtime}/mask-width`);
        expectNear(geometry.mask.rect.height, geometry.viewport.height, `${runtime}/mask-height`);
        // "No blur" as the browser resolves it, rather than as an absent token.
        expect(geometry.mask.backdropFilter, `${runtime}/mask-no-blur`).toBe('none');
        expect(geometry.mask.boxShadow, `${runtime}/mask-flat`).toBe('none');
        expect(geometry.mask.borderTopWidth, `${runtime}/mask-borderless`).toBe('0px');

        // P-BRUTALIST-DIALOG-CONTENT-VISUAL-GRAMMAR: centred square hard-shadowed panel.
        expectCentred(geometry, `${runtime}/initial`);
        // Square corners as rendered. A radius the closure never generated also
        // resolves to `0px`, so this states the result rather than separating a
        // conforming `rounded-none` from a token that failed to reach the CSS.
        expect(geometry.content.borderRadius, `${runtime}/square`).toBe('0px');
        // The arbitrary-value shadow has to survive the token closure to render
        // at all; Tailwind composes it after two empty ring layers.
        expect(geometry.content.boxShadow, `${runtime}/hard-shadow`).toContain(HARD_PANEL_SHADOW);

        // The panel is the surface a reader interacts with, so it has to be the
        // one under the pointer at its own centre, not the scrim above it.
        expect(geometry.content.zIndex, `${runtime}/stacking`).toBeGreaterThan(
          geometry.mask.zIndex
        );
        expect(geometry.centreHitInsideContent, `${runtime}/centre-hit`).toBe(true);

        // A panel positioned once at mount would still satisfy everything above.
        await page.setViewportSize({ ...RESIZED_VIEWPORT });
        const resized = await readOverlayGeometry(page);
        expect(resized.viewport.width, `${runtime}/resized-viewport`).toBe(RESIZED_VIEWPORT.width);
        expectCentred(resized, `${runtime}/resized`);
        expectNear(
          resized.mask.rect.width,
          RESIZED_VIEWPORT.width,
          `${runtime}/resized-mask-width`
        );
        expectNear(
          resized.mask.rect.height,
          RESIZED_VIEWPORT.height,
          `${runtime}/resized-mask-height`
        );

        // Leave the document as the next runtime expects to find it.
        await closeDialog(page);
      }
    } finally {
      await context.close();
    }
  }, 300_000);
});
