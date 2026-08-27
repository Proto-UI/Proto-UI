// @vitest-environment node

import {
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BUTTON_ROUTE = '/en/ui-libraries/brutalist/components/button/';
const BUTTON_SELECTOR = '.host [data-pui-root]';
const BUTTON_COUNT = 9;
const VIEWPORT = { width: 1440, height: 900 } as const;
const EVIDENCE_DIR = process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;
const ACCENT_PAIRS = [
  { backgroundColor: 'rgb(254, 240, 138)', color: 'rgb(0, 0, 0)' },
  { backgroundColor: 'rgb(167, 243, 208)', color: 'rgb(0, 0, 0)' },
  { backgroundColor: 'rgb(221, 214, 254)', color: 'rgb(0, 0, 0)' },
  { backgroundColor: 'rgb(254, 205, 211)', color: 'rgb(0, 0, 0)' },
  { backgroundColor: 'rgb(186, 230, 253)', color: 'rgb(0, 0, 0)' },
] as const;

type HostTheme = 'light' | 'dark';

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

async function setHostTheme(page: Page, theme: HostTheme): Promise<void> {
  await page.evaluate((nextTheme) => {
    const themeApi = (
      window as Window & {
        StarlightTheme?: { set(theme: 'light' | 'dark'): void };
      }
    ).StarlightTheme;
    if (!themeApi) throw new Error('StarlightTheme host API is unavailable.');
    themeApi.set(nextTheme);
  }, theme);
  await page.waitForFunction(
    (expectedTheme) => document.documentElement.dataset.theme === expectedTheme,
    theme,
    { timeout: 10_000 }
  );
}

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

async function captureFrame(locator: Locator, runtime: string, frame: string): Promise<Buffer> {
  if (!EVIDENCE_DIR) return locator.screenshot();
  await mkdir(EVIDENCE_DIR, { recursive: true });
  return locator.screenshot({ path: join(EVIDENCE_DIR, `${runtime}-${frame}.png`) });
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
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe.sequential('Brutalist Button browser regressions', () => {
  for (const runtime of RUNTIMES) {
    it(`preserves visual, interaction, and live-theme contracts in ${runtime}`, async () => {
      const { context, page, previewer } = await openRoute(
        browser,
        baseUrl,
        BUTTON_ROUTE,
        VIEWPORT
      );

      try {
        await setHostTheme(page, 'light');
        await selectRuntime(page, previewer, runtime, BUTTON_SELECTOR, BUTTON_COUNT);

        const buttons = previewer.locator(BUTTON_SELECTOR);
        await expect(buttons.count()).resolves.toBe(BUTTON_COUNT);
        const originalButtons = await buttons.elementHandles();
        expect(originalButtons).toHaveLength(BUTTON_COUNT);
        const assertOriginalButtons = async (phase: string): Promise<void> => {
          const identities = await Promise.all(
            originalButtons.map((original, index) =>
              buttons.nth(index).evaluate((current, initial) => current === initial, original)
            )
          );
          expect(identities, phase).toEqual(Array(BUTTON_COUNT).fill(true));
        };
        const solid = buttons.nth(0);
        const surface = buttons.nth(5);
        const disabledSurface = buttons.nth(8);
        const interactionFrame = previewer.locator('.host');
        expect(await surface.textContent()).toContain('Surface');
        expect(await disabledSurface.textContent()).toContain('Disabled');

        const resting = await styleOf(solid);
        expect(resting).toMatchObject({
          backgroundImage: 'none',
          borderColor: 'rgb(0, 0, 0)',
          borderRadius: '0px',
          borderStyle: 'solid',
          borderWidth: '2px',
          transform: 'none',
        });
        expect(resting.boxShadow).toMatch(/(?:^|, )rgb\(0, 0, 0\) 3px 3px 0px 0px$/);

        await solid.hover();
        await waitForState(page, 0, 'data-hovered', true);
        const hovered = await styleOf(solid);
        expect(hovered.boxShadow).toMatch(/(?:^|, )rgb\(0, 0, 0\) 4px 4px 0px 0px$/);
        expect(hovered.transform).toBe('matrix(1, 0, 0, 1, -1, -1)');
        const hoveredFrame = await captureFrame(interactionFrame, runtime, 'hovered');

        const bounds = await solid.boundingBox();
        expect(bounds).not.toBeNull();
        await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await page.mouse.down();
        await waitForState(page, 0, 'data-pressed', true);
        const pressed = await styleOf(solid);
        expect(pressed.boxShadow).toMatch(/^(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(?:, )?)+$/);
        expect(pressed.transform).toBe('matrix(1, 0, 0, 1, 1, 1)');
        const pressedFrame = await captureFrame(interactionFrame, runtime, 'pressed');
        expect(pressedFrame.equals(hoveredFrame)).toBe(false);

        await page.mouse.up();
        await waitForState(page, 0, 'data-pressed', false);
        const settledFrame = await captureFrame(interactionFrame, runtime, 'settled');
        expect(settledFrame.equals(hoveredFrame)).toBe(true);

        await previewer.locator('select.adapter-select').focus();
        await page.keyboard.press('Tab');
        await waitForState(page, 0, 'data-focus-visible', true);
        const focused = await styleOf(solid);
        expect(focused.boxShadow).toContain('0px 0px 0px 2px');
        expect(focused.boxShadow).toContain('0px 0px 0px 4px');

        expect(await disabledSurface.getAttribute('data-disabled')).not.toBeNull();
        const disabledLight = await styleOf(disabledSurface);
        expect(disabledLight.opacity).toBe('0.5');
        expect(disabledLight.pointerEvents).toBe('none');

        const accentsLight = await Promise.all(
          ACCENT_PAIRS.map((_, index) => styleOf(buttons.nth(index)))
        );
        const surfaceLight = await styleOf(surface);
        expect(
          accentsLight.map(({ backgroundColor, color }) => ({ backgroundColor, color }))
        ).toEqual(ACCENT_PAIRS);
        expect(surfaceLight.backgroundColor).toBe('rgb(255, 255, 255)');
        expect(surfaceLight.color).toBe('rgb(23, 23, 23)');
        expect(disabledLight.backgroundColor).toBe(surfaceLight.backgroundColor);
        expect(disabledLight.color).toBe(surfaceLight.color);
        const lightFrame = await captureFrame(previewer.locator('.host'), runtime, 'light');

        // Drive the host API directly: this is a live host-theme transition,
        // not a colorScheme prop, media query, remount, or pointer refresh.
        await setHostTheme(page, 'dark');
        await assertOriginalButtons(`${runtime}/dark identity`);
        const accentsDark = await Promise.all(
          ACCENT_PAIRS.map((_, index) => styleOf(buttons.nth(index)))
        );
        const surfaceDark = await styleOf(surface);
        const disabledDark = await styleOf(disabledSurface);
        expect(
          accentsDark.map(({ backgroundColor, color }) => ({ backgroundColor, color }))
        ).toEqual(ACCENT_PAIRS);
        expect(surfaceDark.backgroundColor).toBe('rgb(38, 38, 38)');
        expect(surfaceDark.color).toBe('rgb(245, 245, 245)');
        expect(disabledDark.backgroundColor).toBe(surfaceDark.backgroundColor);
        expect(disabledDark.color).toBe(surfaceDark.color);
        const darkFrame = await captureFrame(previewer.locator('.host'), runtime, 'dark');
        expect(darkFrame.equals(lightFrame)).toBe(false);

        await setHostTheme(page, 'light');
        await assertOriginalButtons(`${runtime}/restored-light identity`);
        const accentsRestored = await Promise.all(
          ACCENT_PAIRS.map((_, index) => styleOf(buttons.nth(index)))
        );
        expect(accentsRestored).toEqual(accentsLight);
        expect(await styleOf(surface)).toMatchObject({
          backgroundColor: surfaceLight.backgroundColor,
          color: surfaceLight.color,
        });
        expect(await styleOf(disabledSurface)).toMatchObject({
          backgroundColor: disabledLight.backgroundColor,
          color: disabledLight.color,
          opacity: '0.5',
        });
        const restoredLightFrame = await captureFrame(
          previewer.locator('.host'),
          runtime,
          'light-restored'
        );
        expect(restoredLightFrame.equals(lightFrame)).toBe(true);
      } finally {
        await context.close();
      }
    }, 90_000);
  }
});
