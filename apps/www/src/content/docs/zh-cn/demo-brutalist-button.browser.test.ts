// @vitest-environment node

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  launchBrowser,
  openRoute,
  runtimeSelectTrigger,
  selectRuntime,
  startServer,
  stopServer,
  type RuntimeId,
} from './browser-harness';

const BUTTON_ROUTE = '/en/ui-libraries/brutalist/components/button/';
const BUTTON_SELECTOR = '.host [data-pui-root]';
const BUTTON_COUNT = 10;
const BUTTON_RUNTIMES = ['wc', 'react', 'vue'] as const satisfies readonly RuntimeId[];
const VIEWPORT = { width: 1440, height: 900 } as const;
const EVIDENCE_DIR = process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;

type ButtonStyle = Readonly<{
  backgroundColor: string;
  backgroundImage: string;
  borderColor: string;
  borderRadius: string;
  borderStyle: string;
  borderWidth: string;
  boxShadow: string;
  color: string;
  opacity: string;
  pointerEvents: string;
  transform: string;
}>;

let browser: Browser;
let baseUrl: string;

async function styleOf(button: Locator): Promise<ButtonStyle> {
  return button.evaluate((element: HTMLElement) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderTopColor,
      borderRadius: style.borderTopLeftRadius,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      boxShadow: style.boxShadow,
      color: style.color,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      transform: style.transform,
    };
  });
}

function geometryOf(style: ButtonStyle) {
  return {
    borderColor: style.borderColor,
    borderRadius: style.borderRadius,
    borderStyle: style.borderStyle,
    borderWidth: style.borderWidth,
    boxShadow: style.boxShadow,
    transform: style.transform,
  };
}

async function resolvedTokenColors(
  page: Page,
  tokens: readonly `--pui-${string}`[]
): Promise<string[]> {
  return page.evaluate((colorTokens) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.pointerEvents = 'none';
    probe.style.visibility = 'hidden';
    document.body.append(probe);

    try {
      return colorTokens.map((token) => {
        if (!rootStyle.getPropertyValue(token).trim()) {
          throw new Error(`Theme token ${token} is unavailable.`);
        }
        probe.style.setProperty('color', `var(${token})`, 'important');
        return getComputedStyle(probe).color;
      });
    } finally {
      probe.remove();
    }
  }, tokens);
}

async function persistFrame(locator: Locator, runtime: RuntimeId, frame: string): Promise<void> {
  if (!EVIDENCE_DIR) return;
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await locator.screenshot({ path: join(EVIDENCE_DIR, `${runtime}-${frame}.png`) });
}

async function waitForState(
  page: Page,
  index: number,
  attribute: 'data-focus-visible' | 'data-hovered' | 'data-pressed',
  present: boolean
): Promise<void> {
  await page.waitForFunction(
    ({ attributeName, buttonIndex, shouldBePresent, selector }) => {
      const button = document.querySelectorAll<HTMLElement>(selector)[buttonIndex];
      return button?.hasAttribute(attributeName) === shouldBePresent;
    },
    {
      attributeName: attribute,
      buttonIndex: index,
      selector: BUTTON_SELECTOR,
      shouldBePresent: present,
    },
    { timeout: 10_000 }
  );
}

beforeAll(async () => {
  baseUrl = await startServer(BUTTON_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Brutalist Button browser regressions', () => {
  for (const runtime of BUTTON_RUNTIMES) {
    it(`preserves visual and interaction projections in ${runtime}`, async () => {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        BUTTON_ROUTE,
        VIEWPORT
      );

      try {
        await selectRuntime(page, previewer, runtime, BUTTON_SELECTOR, BUTTON_COUNT);

        const buttons = previewer.locator(BUTTON_SELECTOR);
        await expect(buttons.count()).resolves.toBe(BUTTON_COUNT);
        const solid = buttons.nth(0);
        const disabledSolid = buttons.nth(8);
        const interactionFrame = previewer.locator('.host');

        expect(
          await buttons.evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).backgroundImage)
          ),
          `${runtime}/flat-fills`
        ).toEqual(Array(BUTTON_COUNT).fill('none'));

        const resting = await styleOf(solid);
        expect(resting, `${runtime}/rest`).toMatchObject({
          borderColor: 'rgb(0, 0, 0)',
          borderRadius: '0px',
          borderStyle: 'solid',
          borderWidth: '2px',
          transform: 'none',
        });
        expect(resting.boxShadow, `${runtime}/rest-hard-shadow`).toMatch(
          /(?:^|, )rgb\(0, 0, 0\) 3px 3px 0px 0px$/
        );
        await persistFrame(interactionFrame, runtime, 'rest');

        await solid.hover();
        await waitForState(page, 0, 'data-hovered', true);
        const hovered = await styleOf(solid);
        expect(hovered.boxShadow, `${runtime}/hover-hard-shadow`).toMatch(
          /(?:^|, )rgb\(0, 0, 0\) 4px 4px 0px 0px$/
        );
        expect(hovered.boxShadow, `${runtime}/hover-shadow-delta`).not.toBe(resting.boxShadow);
        expect(hovered.transform, `${runtime}/hover-transform`).toBe('matrix(1, 0, 0, 1, -1, -1)');
        expect(hovered.transform, `${runtime}/hover-transform-delta`).not.toBe(resting.transform);
        await persistFrame(interactionFrame, runtime, 'hover');

        const bounds = await solid.boundingBox();
        expect(bounds, `${runtime}/button-bounds`).not.toBeNull();
        await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await page.mouse.down();
        await waitForState(page, 0, 'data-pressed', true);
        const pressed = await styleOf(solid);
        expect(
          pressed.boxShadow === 'none' ||
            /^(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(?:, )?)+$/.test(pressed.boxShadow),
          `${runtime}/pressed-shadow-cleared`
        ).toBe(true);
        expect(pressed.boxShadow, `${runtime}/pressed-shadow-delta`).not.toBe(hovered.boxShadow);
        expect(pressed.transform, `${runtime}/pressed-transform`).toBe('matrix(1, 0, 0, 1, 1, 1)');
        expect(pressed.transform, `${runtime}/pressed-transform-delta`).not.toBe(hovered.transform);
        await persistFrame(interactionFrame, runtime, 'pressed');

        await page.mouse.up();
        await waitForState(page, 0, 'data-pressed', false);
        const settled = await styleOf(solid);
        expect(settled.boxShadow, `${runtime}/settled-shadow`).toBe(hovered.boxShadow);
        expect(settled.transform, `${runtime}/settled-transform`).toBe(hovered.transform);
        await persistFrame(interactionFrame, runtime, 'settled');

        await page.mouse.move(0, 0);
        await waitForState(page, 0, 'data-hovered', false);
        await runtimeSelectTrigger(previewer).focus();
        await page.keyboard.press('Tab');
        await waitForState(page, 0, 'data-focus-visible', true);
        const focused = await styleOf(solid);
        const [ringOffsetColor, ringColor] = await resolvedTokenColors(page, [
          '--pui-background',
          '--pui-ring',
        ]);
        if (!ringOffsetColor || !ringColor) {
          throw new Error('Expected resolved focus ring and ring-offset colors.');
        }
        expect(ringOffsetColor, `${runtime}/ring-offset-visible`).not.toMatch(
          /^(?:transparent|rgba\([^)]*, 0\))$/
        );
        expect(ringColor, `${runtime}/ring-visible`).not.toMatch(
          /^(?:transparent|rgba\([^)]*, 0\))$/
        );
        expect(focused.boxShadow, `${runtime}/ring-offset`).toContain(
          `${ringOffsetColor} 0px 0px 0px 2px`
        );
        expect(focused.boxShadow, `${runtime}/ring`).toContain(`${ringColor} 0px 0px 0px 4px`);
        await persistFrame(interactionFrame, runtime, 'focus-visible');

        expect(await disabledSolid.getAttribute('data-disabled'), `${runtime}/disabled`).not.toBe(
          null
        );
        const disabled = await styleOf(disabledSolid);
        expect(disabled.opacity, `${runtime}/disabled-opacity`).toBe('0.5');
        expect(disabled.pointerEvents, `${runtime}/disabled-pointer-events`).toBe('none');
        expect(disabled.backgroundColor, `${runtime}/disabled-background`).toBe(
          resting.backgroundColor
        );
        expect(disabled.color, `${runtime}/disabled-foreground`).toBe(resting.color);
        expect(geometryOf(disabled), `${runtime}/disabled-geometry`).toEqual(geometryOf(resting));
      } finally {
        await context.close();
      }
    }, 90_000);
  }
});
