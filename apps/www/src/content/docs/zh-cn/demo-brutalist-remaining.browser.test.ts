// @vitest-environment node

import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  applyColorScheme,
  RUNTIMES,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const BADGE_ROUTE = '/en/ui-libraries/brutalist/components/badge/';
const CARD_ROUTE = '/en/ui-libraries/brutalist/components/card/';
const SEPARATOR_ROUTE = '/en/ui-libraries/brutalist/components/separator/';
const SKELETON_ROUTE = '/en/ui-libraries/brutalist/components/skeleton/';
const TOGGLE_ROUTE = '/en/ui-libraries/brutalist/components/toggle/';
const HOVER_CARD_ROUTE = '/en/ui-libraries/brutalist/components/hover-card/';
const REMAINING_ROUTES = [
  BADGE_ROUTE,
  CARD_ROUTE,
  SEPARATOR_ROUTE,
  SKELETON_ROUTE,
  TOGGLE_ROUTE,
  HOVER_CARD_ROUTE,
] as const;
const NARROW_VIEWPORT = { width: 320, height: 844 } as const;
const BROWSER_RUNTIMES = RUNTIMES;
type BrowserRuntime = (typeof BROWSER_RUNTIMES)[number];
const requestedRuntime = process.env.PROTO_UI_PR539_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? BROWSER_RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : BROWSER_RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_PR539_BROWSER_RUNTIME must be one of ${BROWSER_RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

type SurfaceFacts = {
  role: string | null;
  tabIndex: number;
  ariaSelected: string | null;
  ariaPressed: string | null;
  ariaLive: string | null;
  ariaBusy: string | null;
  hasActiveState: boolean;
  hasPressedState: boolean;
  hasSelectedState: boolean;
  borderWidths: string[];
  borderColors: string[];
  borderRadii: string[];
  backgroundColor: string;
  backgroundImage: string;
  color: string;
  outlineStyle: string;
  outlineWidth: string;
  outlineOffset: string;
  outlineColor: string;
  transitionProperty: string;
  transitionDuration: string;
  animationDuration: string;
  boxShadow: string;
  backdropFilter: string;
  display: string;
  flexDirection: string;
  fontFamily: string;
  fontWeight: string;
  textTransform: string;
  padding: string;
  fontSize: string;
  lineHeight: string;
  pointerEvents: string;
  opacity: string;
  width: string;
  height: string;
};

async function facts(locator: Locator): Promise<SurfaceFacts> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const htmlElement = element as HTMLElement;
    return {
      role: element.getAttribute('role'),
      tabIndex: htmlElement.tabIndex,
      ariaSelected: element.getAttribute('aria-selected'),
      ariaPressed: element.getAttribute('aria-pressed'),
      ariaLive: element.getAttribute('aria-live'),
      ariaBusy: element.getAttribute('aria-busy'),
      hasActiveState: element.hasAttribute('data-active'),
      hasPressedState: element.hasAttribute('data-pressed'),
      hasSelectedState: element.hasAttribute('data-selected'),
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      borderColors: [
        style.borderTopColor,
        style.borderRightColor,
        style.borderBottomColor,
        style.borderLeftColor,
      ],
      borderRadii: [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ],
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      color: style.color,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      outlineColor: style.outlineColor,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      animationDuration: style.animationDuration,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter,
      display: style.display,
      flexDirection: style.flexDirection,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      textTransform: style.textTransform,
      padding: style.padding,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      width: style.width,
      height: style.height,
    };
  });
}

type SeparatorGeometry = {
  orientation: string | null;
  width: number;
  height: number;
  parentWidth: number;
  parentHeight: number;
};

async function separatorGeometry(locator: Locator): Promise<SeparatorGeometry> {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const parentBox = element.parentElement?.getBoundingClientRect();
    return {
      orientation: element.getAttribute('data-orientation'),
      width: box.width,
      height: box.height,
      parentWidth: parentBox?.width ?? 0,
      parentHeight: parentBox?.height ?? 0,
    };
  });
}

function roots(previewer: Locator): Locator {
  return previewer.locator('.host [data-pui-root]');
}

async function expectVisibility(locator: Locator, visible: boolean, label: string): Promise<void> {
  await locator.waitFor({ state: visible ? 'visible' : 'hidden', timeout: 10_000 });
  expect(await locator.isVisible(), label).toBe(visible);
}

async function waitForHoverCardEndpoint(page: Page, panel: Locator): Promise<void> {
  await panel.waitFor({ state: 'visible', timeout: 10_000 });
  const element = await panel.elementHandle();
  if (!element) throw new Error('Hover Card panel was not materialized.');
  await page.waitForFunction(
    (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tokens = target.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
      return (
        !target.hasAttribute('data-pui-view-pending') &&
        !target.hasAttribute('data-pui-view-revealing') &&
        target.getAttribute('data-transition-state') === 'entered' &&
        tokens.includes('transition-none') &&
        tokens.includes('duration-200')
      );
    },
    element,
    { timeout: 10_000 }
  );
}

async function resolvedThemeColors(
  page: Page,
  property: 'backgroundColor' | 'color' | 'borderTopColor',
  variables: readonly string[]
): Promise<string[]> {
  return page.evaluate(
    ({ property: cssProperty, variables: customProperties }) => {
      const probe = document.createElement('span');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      document.body.appendChild(probe);
      const values = customProperties.map((customProperty) => {
        probe.style[cssProperty] = `var(${customProperty})`;
        return getComputedStyle(probe)[cssProperty];
      });
      probe.remove();
      return values;
    },
    { property, variables }
  );
}

async function selectRuntimeWithDiagnostics(
  page: Page,
  previewer: Locator,
  runtime: BrowserRuntime,
  readySelector: string,
  expectedCount: number
): Promise<void> {
  try {
    await selectRuntime(page, previewer, runtime, readySelector, expectedCount);
  } catch (error) {
    const diagnostics = await page.evaluate(
      ({ selector }) => {
        const root = document.querySelector<HTMLElement>('[data-previewer-id]');
        const host = root?.querySelector<HTMLElement>('.host');
        const firstRoot = host?.querySelector<HTMLElement>('[data-pui-root]');
        const select = root?.querySelector<HTMLSelectElement>('select.adapter-select');
        return {
          selected: root?.querySelector<HTMLElement>('[data-adapter-select-root]')?.dataset.value,
          nativeSelected: select?.value,
          disabled: select?.disabled,
          rootCount: host?.querySelectorAll(selector).length ?? 0,
          firstTag: firstRoot?.tagName ?? null,
          hasVueApp: host?.hasAttribute('data-v-app') ?? false,
          hasVue2Instance: Boolean((firstRoot as HTMLElement & { __vue__?: unknown })?.__vue__),
          previewError:
            root?.querySelector('[data-preview-error], [data-error]')?.textContent ?? null,
        };
      },
      { selector: readySelector }
    );
    throw new Error(`selectRuntime(${runtime}) diagnostics: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    });
  }
}

function nonTransparentShadowLayers(boxShadow: string): string[] {
  return boxShadow
    .split(/,\s*(?=(?:rgba?|oklab|rgb)\()/u)
    .filter((layer) => !layer.includes('rgba(0, 0, 0, 0)'));
}

type ShadowLayer = {
  inset: boolean;
  color: string;
  lengths: string[];
};

/**
 * Computed `boxShadow` serializes each layer as `<color> <x> <y> <blur> <spread> [inset]`,
 * so a layer can be parsed back into its outset/inset flag, ink, and exact geometry
 * without relying on substring matching.
 */
function parseShadowLayer(layer: string): ShadowLayer {
  const trimmed = layer.trim();
  const inset = /\binset\b/u.test(trimmed);
  const withoutInset = trimmed.replace(/\binset\b/u, '').trim();
  const color = withoutInset.match(/^(?:rgba?|oklch|oklab|color)\([^)]*\)/u)?.[0] ?? '';
  return {
    inset,
    color,
    lengths: withoutInset.slice(color.length).trim().split(/\s+/u).filter(Boolean),
  };
}

function expectSquareBorder(surface: SurfaceFacts, label: string): void {
  expect(surface.borderWidths, `${label}/border-widths`).toEqual(Array(4).fill('2px'));
  expect(surface.borderRadii, `${label}/radius`).toEqual(Array(4).fill('0px'));
}

function expectBorderColors(surface: SurfaceFacts, expectedColor: string, label: string): void {
  expect(surface.borderColors, `${label}/border-colors`).toEqual(Array(4).fill(expectedColor));
}

function expectHardFrame(
  surface: SurfaceFacts,
  shadowOffset: string,
  shadowColor: string,
  label: string
): void {
  expectSquareBorder(surface, label);
  expectExactHardShadow(surface.boxShadow, shadowOffset, shadowColor, label);
}

function expectExactHardShadow(
  boxShadow: string,
  offset: string,
  expectedColor: string,
  label: string,
  expectedLayerCount = 1
): void {
  const layers = nonTransparentShadowLayers(boxShadow).map(parseShadowLayer);
  expect(layers, `${label}/shadow-layers`).toHaveLength(expectedLayerCount);
  const hardShadows = layers.filter(
    (layer) =>
      !layer.inset &&
      layer.lengths.length === 4 &&
      layer.lengths[0] === offset &&
      layer.lengths[1] === offset &&
      layer.lengths[2] === '0px' &&
      layer.lengths[3] === '0px'
  );
  expect(hardShadows, `${label}/outset-hard-shadow`).toHaveLength(1);
  expect(hardShadows[0].color, `${label}/shadow-color`).toBe(expectedColor);
}

/**
 * The active Brutalist Toggle keeps a persistent, color-independent inset ink
 * frame (`inset 0 0 0 2px #000`) beside its resting outset hard shadow. This
 * asserts the parsed inset layer's flag, zero-blur geometry, and black ink.
 */
function expectInsetFrame(boxShadow: string, label: string): void {
  const insetLayers = nonTransparentShadowLayers(boxShadow)
    .map(parseShadowLayer)
    .filter((layer) => layer.inset);
  expect(insetLayers, `${label}/inset-layer`).toHaveLength(1);
  const inset = insetLayers[0];
  expect(inset.lengths, `${label}/inset-geometry`).toHaveLength(4);
  expect(inset.lengths[0], `${label}/inset-offset-x`).toBe('0px');
  expect(inset.lengths[1], `${label}/inset-offset-y`).toBe('0px');
  expect(inset.lengths[2], `${label}/inset-blur`).toBe('0px');
  expect(inset.lengths[3], `${label}/inset-spread`).toBe('2px');
  expect(inset.color, `${label}/inset-color`).toBe('rgb(0, 0, 0)');
}

/** A passive root carries no `tabindex` and must not retain programmatic focus. */
async function expectPassiveFocus(locator: Locator, label: string): Promise<void> {
  const state = await locator.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.focus();
    return {
      hasTabIndexAttribute: element.hasAttribute('tabindex'),
      retainedFocus: document.activeElement === element,
    };
  });
  expect(state.hasTabIndexAttribute, `${label}/tabindex-attribute`).toBe(false);
  expect(state.retainedFocus, `${label}/focus-retained`).toBe(false);
}
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(REMAINING_ROUTES);
  browser = await launchBrowser();
}, 360_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('remaining Brutalist component browser coverage', () => {
  it('projects Badge tones with passive square hard-shadow surfaces', async () => {
    const opened = await openRoute(browser, baseUrl, BADGE_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, '[data-pui-root]', 3);
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(opened.page, colorScheme);
          const badges = roots(opened.previewer);
          const allFacts = await badges.evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element);
              return {
                role: element.getAttribute('role'),
                tabIndex: (element as HTMLElement).tabIndex,
                ariaSelected: element.getAttribute('aria-selected'),
                ariaPressed: element.getAttribute('aria-pressed'),
                ariaLive: element.getAttribute('aria-live'),
                borderWidths: [
                  style.borderTopWidth,
                  style.borderRightWidth,
                  style.borderBottomWidth,
                  style.borderLeftWidth,
                ],
                borderColors: [
                  style.borderTopColor,
                  style.borderRightColor,
                  style.borderBottomColor,
                  style.borderLeftColor,
                ],
                borderRadii: [
                  style.borderTopLeftRadius,
                  style.borderTopRightRadius,
                  style.borderBottomRightRadius,
                  style.borderBottomLeftRadius,
                ],
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
                color: style.color,
                boxShadow: style.boxShadow,
                fontFamily: style.fontFamily,
                textTransform: style.textTransform,
              };
            })
          );
          const expectedBackgrounds = await resolvedThemeColors(opened.page, 'backgroundColor', [
            '--pui-canary',
            '--pui-sky',
            '--pui-coral',
          ]);
          const expectedForegrounds = await resolvedThemeColors(opened.page, 'color', [
            '--pui-canary-foreground',
            '--pui-sky-foreground',
            '--pui-coral-foreground',
          ]);
          const [expectedBorder] = await resolvedThemeColors(opened.page, 'borderTopColor', [
            '--pui-foreground',
          ]);
          expect(
            allFacts.map((surface) => surface.backgroundColor),
            `${runtime}/background-pairs`
          ).toEqual(expectedBackgrounds);
          expect(
            allFacts.map((surface) => surface.color),
            `${runtime}/foreground-pairs`
          ).toEqual(expectedForegrounds);
          expect(
            allFacts.every((surface) =>
              surface.borderColors.every((color) => color === expectedBorder)
            ),
            `${runtime}/${colorScheme}/border-pair`
          ).toBe(true);
          for (const [index, surface] of allFacts.entries()) {
            const label = `${runtime}/${colorScheme}/badge-${index}`;
            expectExactHardShadow(surface.boxShadow, '2px', expectedBorder, `${label}`);
            expect(surface.role, `${label}/role`).toBeNull();
            expect(surface.tabIndex, `${label}/tabindex`).toBe(-1);
            await expectPassiveFocus(badges.nth(index), label);
            expect(surface.ariaSelected, `${label}/aria-selected`).toBeNull();
            expect(surface.ariaPressed, `${label}/aria-pressed`).toBeNull();
            expect(surface.ariaLive, `${label}/aria-live`).toBeNull();
            expect(surface.borderWidths, `${label}/border-widths`).toEqual(Array(4).fill('2px'));
            expect(surface.borderRadii, `${label}/radius`).toEqual(Array(4).fill('0px'));
            expect(surface.boxShadow, `${label}/shadow`).toContain('2px 2px 0px 0px');
            expect(surface.backgroundImage, `${label}/background-image`).toBe('none');
            expect(
              surface.fontFamily.split(',')[0].trim().toLowerCase(),
              `${label}/font`
            ).toMatch(/mono/);
            expect(surface.textTransform, `${label}/case`).toBe('uppercase');
          }
        }
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('projects Card Root as a passive square paper panel with four regions', async () => {
    const opened = await openRoute(browser, baseUrl, CARD_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, '[data-pui-root]', 5);
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(opened.page, colorScheme);
          const card = roots(opened.previewer).first();
          const surface = await facts(card);
          const [expectedBackground, expectedForeground, expectedBorder] = await Promise.all([
            resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-background']),
            resolvedThemeColors(opened.page, 'color', ['--pui-foreground']),
            resolvedThemeColors(opened.page, 'borderTopColor', ['--pui-foreground']),
          ]).then(([background, foreground, border]) => [background[0], foreground[0], border[0]]);
          expectHardFrame(surface, '6px', expectedBorder, `${runtime}/${colorScheme}/card`);
          expect(surface.backgroundColor, `${runtime}/${colorScheme}/card/background`).toBe(
            expectedBackground
          );
          expect(surface.color, `${runtime}/${colorScheme}/card/foreground`).toBe(
            expectedForeground
          );
          expectBorderColors(surface, expectedBorder, `${runtime}/${colorScheme}/card`);
          expect(surface.display, `${runtime}/${colorScheme}/card/display`).toBe('flex');
          expect(surface.flexDirection, `${runtime}/${colorScheme}/card/direction`).toBe('column');
          expect(surface.role, `${runtime}/${colorScheme}/card/role`).toBeNull();
          expect(surface.tabIndex, `${runtime}/${colorScheme}/card/tabindex`).toBe(-1);
          await expectPassiveFocus(card, `${runtime}/${colorScheme}/card`);
          expect(surface.ariaSelected, `${runtime}/${colorScheme}/card/aria-selected`).toBeNull();
          expect(surface.ariaPressed, `${runtime}/${colorScheme}/card/aria-pressed`).toBeNull();
          expect(surface.ariaLive, `${runtime}/${colorScheme}/card/aria-live`).toBeNull();
          expect(surface.ariaBusy, `${runtime}/${colorScheme}/card/aria-busy`).toBeNull();
          expect(surface.hasActiveState, `${runtime}/${colorScheme}/card/data-active`).toBe(false);
          expect(surface.hasPressedState, `${runtime}/${colorScheme}/card/data-pressed`).toBe(
            false
          );
          expect(surface.hasSelectedState, `${runtime}/${colorScheme}/card/data-selected`).toBe(
            false
          );
          expect(surface.backgroundImage, `${runtime}/${colorScheme}/card/background-image`).toBe(
            'none'
          );
          expect(
            Number.parseFloat(surface.width),
            `${runtime}/${colorScheme}/card/width`
          ).toBeGreaterThan(0);
          expect(
            Number.parseFloat(surface.height),
            `${runtime}/${colorScheme}/card/height`
          ).toBeGreaterThan(0);
        }
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('keeps Separator orientation and two-pixel hard-line geometry across themes', async () => {
    for (const runtime of TEST_RUNTIMES) {
      const opened = await openRoute(browser, baseUrl, SEPARATOR_ROUTE, NARROW_VIEWPORT);
      try {
        await selectRuntimeWithDiagnostics(
          opened.page,
          opened.previewer,
          runtime,
          '[data-pui-root]',
          2
        );
        await opened.page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('[data-previewer-id] .host')?.dataset
              .separatorDemoReady === 'true',
          undefined,
          { timeout: 10_000 }
        );
        const separators = roots(opened.previewer);
        const dynamicSeparator = opened.previewer.locator(
          '.host [data-demo-ref="dynamic-separator"]'
        );
        const before = await separatorGeometry(dynamicSeparator);
        expect(before.orientation, `${runtime}/dynamic/before-orientation`).toBe('vertical');
        expect(before.width, `${runtime}/dynamic/before-thickness`).toBe(2);
        expect(
          Math.abs(before.height - before.parentHeight),
          `${runtime}/dynamic/before-length`
        ).toBeLessThanOrEqual(0.5);
        await opened.page.evaluate(() => {
          document.querySelector('[data-previewer-id] .host')?.dispatchEvent(
            new CustomEvent('proto-ui-test:separator-orientation', {
              detail: { orientation: 'horizontal' },
            })
          );
        });
        await opened.page.waitForFunction(
          () =>
            document
              .querySelector<HTMLElement>(
                '[data-previewer-id] .host [data-demo-ref="dynamic-separator"]'
              )
              ?.getAttribute('data-orientation') === 'horizontal',
          undefined,
          { timeout: 10_000 }
        );
        const after = await separatorGeometry(dynamicSeparator);
        expect(after.orientation, `${runtime}/dynamic/after-orientation`).toBe('horizontal');
        expect(after.height, `${runtime}/dynamic/after-thickness`).toBe(2);
        expect(
          Math.abs(after.width - after.parentWidth),
          `${runtime}/dynamic/after-length`
        ).toBeLessThanOrEqual(0.5);
        await opened.page.evaluate(() => {
          document.querySelector('[data-previewer-id] .host')?.dispatchEvent(
            new CustomEvent('proto-ui-test:separator-orientation', {
              detail: { orientation: 'vertical' },
            })
          );
        });
        await opened.page.waitForFunction(
          () =>
            document
              .querySelector<HTMLElement>(
                '[data-previewer-id] .host [data-demo-ref="dynamic-separator"]'
              )
              ?.getAttribute('data-orientation') === 'vertical',
          undefined,
          { timeout: 10_000 }
        );
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(opened.page, colorScheme);
          const allFacts = await separators.evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element);
              const box = element.getBoundingClientRect();
              const parentBox = element.parentElement?.getBoundingClientRect();
              return {
                orientation: element.getAttribute('data-orientation'),
                width: box.width,
                height: box.height,
                parentWidth: parentBox?.width ?? 0,
                parentHeight: parentBox?.height ?? 0,
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
              };
            })
          );
          const [expectedInk] = await resolvedThemeColors(opened.page, 'backgroundColor', [
            '--pui-foreground',
          ]);
          expect(
            allFacts.map((surface) => surface.orientation),
            `${runtime}/${colorScheme}`
          ).toEqual(['horizontal', 'vertical']);
          expect(allFacts[0].height, `${runtime}/${colorScheme}/horizontal-thickness`).toBe(2);
          expect(
            Math.abs(allFacts[0].width - allFacts[0].parentWidth),
            `${runtime}/${colorScheme}/horizontal-length`
          ).toBeLessThanOrEqual(0.5);
          expect(allFacts[1].width, `${runtime}/${colorScheme}/vertical-thickness`).toBe(2);
          expect(
            Math.abs(allFacts[1].height - allFacts[1].parentHeight),
            `${runtime}/${colorScheme}/vertical-length`
          ).toBeLessThanOrEqual(0.5);
          expect(
            allFacts.every((surface) => surface.backgroundImage === 'none'),
            `${runtime}/${colorScheme}/flat-fill`
          ).toBe(true);
          expect(
            allFacts.every((surface) => surface.backgroundColor === expectedInk),
            `${runtime}/${colorScheme}/ink`
          ).toBe(true);
        }
      } finally {
        await opened.context.close();
      }
    }
  }, 240_000);

  it('keeps Skeleton contentless, hidden, and dimensioned by its consumer', async () => {
    const opened = await openRoute(browser, baseUrl, SKELETON_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, '[data-pui-root]', 3);
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(opened.page, colorScheme);
          const skeletons = roots(opened.previewer);
          const allFacts = await skeletons.evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element);
              return {
                role: element.getAttribute('role'),
                ariaHidden: element.getAttribute('aria-hidden'),
                ariaSelected: element.getAttribute('aria-selected'),
                ariaPressed: element.getAttribute('aria-pressed'),
                ariaLive: element.getAttribute('aria-live'),
                ariaBusy: element.getAttribute('aria-busy'),
                tabIndex: (element as HTMLElement).tabIndex,
                borderWidths: [
                  style.borderTopWidth,
                  style.borderRightWidth,
                  style.borderBottomWidth,
                  style.borderLeftWidth,
                ],
                borderColors: [
                  style.borderTopColor,
                  style.borderRightColor,
                  style.borderBottomColor,
                  style.borderLeftColor,
                ],
                borderRadii: [
                  style.borderTopLeftRadius,
                  style.borderTopRightRadius,
                  style.borderBottomRightRadius,
                  style.borderBottomLeftRadius,
                ],
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
                boxShadow: style.boxShadow,
                animationName: style.animationName,
                animationDuration: style.animationDuration,
                transitionProperty: style.transitionProperty,
                transitionDuration: style.transitionDuration,
                width: style.width,
                height: style.height,
              };
            })
          );
          const [expectedBackground, expectedBorder] = await Promise.all([
            resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-lavender']),
            resolvedThemeColors(opened.page, 'borderTopColor', ['--pui-foreground']),
          ]).then(([background, border]) => [background[0], border[0]]);
          expect(
            await opened.previewer.locator('[data-demo-ref="skeleton-canary"]').count(),
            `${runtime}/skeleton-content`
          ).toBe(0);
          for (const [index, surface] of allFacts.entries()) {
            const label = `${runtime}/skeleton-${index}`;
            expect(surface.role, `${label}/role`).toBeNull();
            expect(surface.ariaHidden, `${label}/hidden`).toBe('true');
            expect(surface.tabIndex, `${label}/tabindex`).toBe(-1);
            await expectPassiveFocus(skeletons.nth(index), label);
            expect(surface.ariaSelected, `${label}/aria-selected`).toBeNull();
            expect(surface.ariaPressed, `${label}/aria-pressed`).toBeNull();
            expect(surface.ariaLive, `${label}/aria-live`).toBeNull();
            expect(surface.ariaBusy, `${label}/aria-busy`).toBeNull();
            expect(surface.borderWidths, `${label}/border-widths`).toEqual(Array(4).fill('2px'));
            expectExactHardShadow(surface.boxShadow, '2px', expectedBorder, `${label}`);
            expect(surface.borderColors, `${label}/border-colors`).toEqual(
              Array(4).fill(expectedBorder)
            );
            expect(surface.borderRadii, `${label}/radius`).toEqual(Array(4).fill('0px'));
            expect(surface.backgroundColor, `${label}/background`).toBe(expectedBackground);
            expect(surface.backgroundImage, `${label}/background-image`).toBe('none');
            expect(surface.animationName, `${label}/animation`).toBe('none');
            expect(surface.animationDuration, `${label}/animation-duration`).toBe('0s');
            expect(surface.transitionDuration, `${label}/transition-duration`).toBe('0s');
            expect(surface.boxShadow, `${label}/shadow`).toContain('2px 2px 0px 0px');
            expect(Number.parseFloat(surface.width), `${label}/width`).toBeGreaterThan(0);
            expect(Number.parseFloat(surface.height), `${label}/height`).toBeGreaterThan(0);
          }
        }
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('projects Toggle active, disabled, and click state with hard frames', async () => {
    const opened = await openRoute(browser, baseUrl, TOGGLE_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, '[data-pui-root]', 4);
        const toggles = roots(opened.previewer);
        const factsBefore = await toggles.evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            return {
              role: element.getAttribute('role'),
              pressed: element.getAttribute('aria-pressed'),
              disabled: element.getAttribute('aria-disabled'),
              borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ],
              borderColors: [
                style.borderTopColor,
                style.borderRightColor,
                style.borderBottomColor,
                style.borderLeftColor,
              ],
              borderRadii: [
                style.borderTopLeftRadius,
                style.borderTopRightRadius,
                style.borderBottomRightRadius,
                style.borderBottomLeftRadius,
              ],
              boxShadow: style.boxShadow,
              backdropFilter: style.backdropFilter,
              backgroundColor: style.backgroundColor,
              backgroundImage: style.backgroundImage,
              color: style.color,
            };
          })
        );
        const [
          expectedRestingBackground,
          expectedRestingForeground,
          expectedActiveBackground,
          expectedActiveForeground,
        ] = await Promise.all([
          resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-secondary-background']),
          resolvedThemeColors(opened.page, 'color', ['--pui-foreground']),
          resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-main']),
          resolvedThemeColors(opened.page, 'color', ['--pui-main-foreground']),
        ]).then(([restingBackground, restingForeground, activeBackground, activeForeground]) => [
          restingBackground[0],
          restingForeground[0],
          activeBackground[0],
          activeForeground[0],
        ]);
        expect(
          factsBefore.map((surface) => surface.pressed),
          runtime
        ).toEqual(['false', 'true', 'false', 'false']);
        expect(
          factsBefore.map((surface) => surface.disabled),
          runtime
        ).toEqual(['false', 'false', 'false', 'true']);
        expect(
          factsBefore.map((surface) => surface.backgroundColor),
          `${runtime}/background-pairs`
        ).toEqual([
          expectedRestingBackground,
          expectedActiveBackground,
          expectedRestingBackground,
          expectedRestingBackground,
        ]);
        expect(
          factsBefore.map((surface) => surface.color),
          `${runtime}/foreground-pairs`
        ).toEqual([
          expectedRestingForeground,
          expectedActiveForeground,
          expectedRestingForeground,
          expectedRestingForeground,
        ]);
        expect(
          factsBefore.every((surface) => surface.backgroundImage === 'none'),
          `${runtime}/flat-fill`
        ).toBe(true);
        expect(
          new Set(factsBefore.map((surface) => surface.backgroundColor)).size,
          runtime
        ).toBeGreaterThan(1);
        for (const [index, surface] of factsBefore.entries()) {
          expect(surface.role, `${runtime}/toggle-${index}/role`).toBe('button');
          const label = `${runtime}/toggle-${index}`;
          expect(surface.borderWidths, `${label}/border-widths`).toEqual(Array(4).fill('2px'));
          expect(surface.borderColors, `${label}/border-colors`).toEqual(
            Array(4).fill('rgb(0, 0, 0)')
          );
          expect(surface.borderRadii, `${label}/radius`).toEqual(Array(4).fill('0px'));
          expectExactHardShadow(
            surface.boxShadow,
            '3px',
            'rgb(0, 0, 0)',
            label,
            index === 1 ? 2 : 1
          );
          expect(surface.backdropFilter, `${label}/backdrop-filter`).toBe('none');
          if (index === 1) {
            expectInsetFrame(surface.boxShadow, label);
          }
        }

        const first = toggles.first();
        await first.click();
        expect(
          await first.getAttribute('aria-pressed'),
          `${runtime}/first-enabled-after-first-click`
        ).toBe('true');
        const firstActiveSurface = await facts(first);
        expect(firstActiveSurface.backgroundColor, `${runtime}/after-first-click/background`).toBe(
          expectedActiveBackground
        );
        expect(firstActiveSurface.color, `${runtime}/after-first-click/foreground`).toBe(
          expectedActiveForeground
        );
        await first.click();
        expect(
          await first.getAttribute('aria-pressed'),
          `${runtime}/first-enabled-after-second-click`
        ).toBe('false');
        const firstRestingSurface = await facts(first);
        expect(
          firstRestingSurface.backgroundColor,
          `${runtime}/after-second-click/background`
        ).toBe(expectedRestingBackground);
        expect(firstRestingSurface.color, `${runtime}/after-second-click/foreground`).toBe(
          expectedRestingForeground
        );
        const firstElement = await first.elementHandle();
        if (!firstElement) throw new Error('Toggle was not materialized.');
        await opened.page.mouse.move(1, NARROW_VIEWPORT.height - 1);
        await opened.page.waitForFunction(
          (target) =>
            target instanceof HTMLElement &&
            !target.hasAttribute('data-hovered') &&
            getComputedStyle(target).boxShadow.includes('3px 3px 0px 0px'),
          firstElement,
          { timeout: 10_000 }
        );
        const disabled = toggles.nth(3);
        expect(
          await disabled.evaluate((element) => getComputedStyle(element).pointerEvents),
          `${runtime}/disabled-pointer-events`
        ).toBe('none');
        expect(
          await disabled.evaluate((element) => getComputedStyle(element).opacity),
          `${runtime}/disabled-opacity`
        ).toBe('0.5');
        await applyColorScheme(opened.page, 'dark');
        const [
          darkRestingBackground,
          darkRestingForeground,
          darkActiveBackground,
          darkActiveForeground,
        ] = await Promise.all([
          resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-secondary-background']),
          resolvedThemeColors(opened.page, 'color', ['--pui-foreground']),
          resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-main']),
          resolvedThemeColors(opened.page, 'color', ['--pui-main-foreground']),
        ]).then(([restingBackground, restingForeground, activeBackground, activeForeground]) => [
          restingBackground[0],
          restingForeground[0],
          activeBackground[0],
          activeForeground[0],
        ]);
        const darkFacts = await toggles.evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            return {
              backgroundColor: style.backgroundColor,
              backgroundImage: style.backgroundImage,
              color: style.color,
              borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ],
              borderColors: [
                style.borderTopColor,
                style.borderRightColor,
                style.borderBottomColor,
                style.borderLeftColor,
              ],
              boxShadow: style.boxShadow,
              backdropFilter: style.backdropFilter,
            };
          })
        );
        expect(
          darkFacts.map((surface) => surface.backgroundColor),
          `${runtime}/dark/background-pairs`
        ).toEqual([
          darkRestingBackground,
          darkActiveBackground,
          darkRestingBackground,
          darkRestingBackground,
        ]);
        expect(
          darkFacts.map((surface) => surface.color),
          `${runtime}/dark/foreground-pairs`
        ).toEqual([
          darkRestingForeground,
          darkActiveForeground,
          darkRestingForeground,
          darkRestingForeground,
        ]);
        expect(
          darkFacts.every((surface) => surface.backgroundImage === 'none'),
          `${runtime}/dark/flat-fill`
        ).toBe(true);
        for (const [index, surface] of darkFacts.entries()) {
          const label = `${runtime}/dark/toggle-${index}`;
          expect(surface.borderWidths, `${label}/border-widths`).toEqual(Array(4).fill('2px'));
          expect(surface.borderColors, `${label}/border-colors`).toEqual(
            Array(4).fill('rgb(0, 0, 0)')
          );
          expectExactHardShadow(
            surface.boxShadow,
            '3px',
            'rgb(0, 0, 0)',
            label,
            index === 1 ? 2 : 1
          );
          expect(surface.backdropFilter, `${label}/backdrop-filter`).toBe('none');
          if (index === 1) {
            expectInsetFrame(surface.boxShadow, label);
          }
        }
        await applyColorScheme(opened.page, 'light');
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('opens Hover Card from pointer and focus while preserving square trigger and panel surfaces', async () => {
    const opened = await openRoute(browser, baseUrl, HOVER_CARD_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await opened.page.mouse.move(1, 843);
        await selectRuntimeWithDiagnostics(
          opened.page,
          opened.previewer,
          runtime,
          '[data-pui-root]',
          3
        );
        const nodes = opened.previewer.locator('.host [data-pui-root]');
        const trigger = nodes.nth(1);
        await opened.page.mouse.move(5, 5);
        const triggerElement = await trigger.elementHandle();
        if (!triggerElement) throw new Error('Hover Card trigger was not materialized.');
        await opened.page.waitForFunction(
          (target) =>
            target instanceof HTMLElement &&
            !target.hasAttribute('data-hovered') &&
            !target.hasAttribute('data-pressed') &&
            !target.hasAttribute('data-open') &&
            getComputedStyle(target).boxShadow.includes('3px 3px 0px 0px'),
          triggerElement,
          { timeout: 10_000 }
        );
        const panelText = opened.page
          .getByText('A square hard-shadowed preview panel.', { exact: true })
          .last();
        const triggerSurface = await facts(trigger);
        const [expectedTriggerBackground] = await resolvedThemeColors(
          opened.page,
          'backgroundColor',
          ['--pui-main']
        );
        const [expectedTriggerForeground] = await resolvedThemeColors(opened.page, 'color', [
          '--pui-main-foreground',
        ]);
        expect(triggerSurface.backgroundColor, `${runtime}/hover-trigger/background`).toBe(
          expectedTriggerBackground
        );
        expect(triggerSurface.color, `${runtime}/hover-trigger/foreground`).toBe(
          expectedTriggerForeground
        );
        expect(triggerSurface.backgroundImage, `${runtime}/hover-trigger/background-image`).toBe(
          'none'
        );
        expect(triggerSurface.backdropFilter, `${runtime}/hover-trigger/backdrop-filter`).toBe(
          'none'
        );
        expectBorderColors(triggerSurface, 'rgb(0, 0, 0)', `${runtime}/hover-trigger`);
        expect(triggerSurface.fontWeight, `${runtime}/hover-trigger/weight`).toBe('700');
        expect(triggerSurface.textTransform, `${runtime}/hover-trigger/case`).toBe('uppercase');
        expectHardFrame(triggerSurface, '3px', 'rgb(0, 0, 0)', `${runtime}/hover-trigger`);
        expect(triggerSurface.role, `${runtime}/hover-trigger/role`).toBeNull();
        expect(triggerSurface.tabIndex, `${runtime}/hover-trigger/tabindex`).toBeGreaterThanOrEqual(
          0
        );

        await trigger.hover();
        await expectVisibility(panelText, true, `${runtime}/hover-pointer-open`);
        const panel = panelText.locator('xpath=ancestor-or-self::*[@data-pui-root][1]');
        // View visibility is not a transition endpoint. Wait for the actual
        // committed host tokens and governed enter lifecycle before sampling.
        await waitForHoverCardEndpoint(opened.page, panel);
        const panelSurface = await facts(panel);
        const [expectedPanelBackground] = await resolvedThemeColors(
          opened.page,
          'backgroundColor',
          ['--pui-secondary-background']
        );
        const [expectedPanelForeground] = await resolvedThemeColors(opened.page, 'color', [
          '--pui-foreground',
        ]);
        expectHardFrame(panelSurface, '3px', 'rgb(0, 0, 0)', `${runtime}/hover-panel`);
        expect(panelSurface.backgroundColor, `${runtime}/hover-panel/background`).toBe(
          expectedPanelBackground
        );
        expect(panelSurface.color, `${runtime}/hover-panel/foreground`).toBe(
          expectedPanelForeground
        );
        expect(panelSurface.backgroundImage, `${runtime}/hover-panel/background-image`).toBe(
          'none'
        );
        expect(panelSurface.backdropFilter, `${runtime}/hover-panel/backdrop-filter`).toBe('none');
        expectBorderColors(panelSurface, 'rgb(0, 0, 0)', `${runtime}/hover-panel`);
        expect(panelSurface.width, `${runtime}/hover-panel/width`).toBe('256px');
        expect(panelSurface.padding, `${runtime}/hover-panel/padding`).toBe('16px');
        expect(panelSurface.fontSize, `${runtime}/hover-panel/font-size`).toBe('14px');
        expect(panelSurface.lineHeight, `${runtime}/hover-panel/line-height`).toBe('24px');
        expect(panelSurface.outlineStyle, `${runtime}/hover-panel/outline-style`).toBe('solid');
        expect(panelSurface.outlineWidth, `${runtime}/hover-panel/outline-width`).toBe('2px');
        expect(panelSurface.outlineOffset, `${runtime}/hover-panel/outline-offset`).toBe('2px');
        expect(panelSurface.outlineColor, `${runtime}/hover-panel/outline-color`).toBe(
          'rgba(0, 0, 0, 0)'
        );
        expect(panelSurface.transitionProperty, `${runtime}/hover-panel/transition-property`).toBe(
          'none'
        );
        expect(panelSurface.transitionDuration, `${runtime}/hover-panel/transition-duration`).toBe(
          '0.2s'
        );
        expect(panelSurface.animationDuration, `${runtime}/hover-panel/animation-duration`).toBe(
          '0.2s'
        );

        await trigger.dispatchEvent('pointerleave');
        await expectVisibility(panelText, false, `${runtime}/hover-pointer-close`);
        await trigger.focus();
        expect(
          await trigger.evaluate((element) => document.activeElement === element),
          `${runtime}/hover-focus-retained`
        ).toBe(true);
        await expectVisibility(panelText, true, `${runtime}/hover-focus-open`);
        await trigger.evaluate((element) => (element as HTMLElement).blur());
        await trigger.dispatchEvent('pointerleave');
        await expectVisibility(panelText, false, `${runtime}/hover-focus-close`);
        await applyColorScheme(opened.page, 'dark');
        const darkTrigger = opened.previewer.locator('.host [data-pui-root]').nth(1);
        const darkPanelText = opened.page
          .getByText('A square hard-shadowed preview panel.', { exact: true })
          .last();
        await darkTrigger.focus();
        await expectVisibility(darkPanelText, true, `${runtime}/dark/hover-focus-open`);
        const darkPanel = darkPanelText.locator('xpath=ancestor-or-self::*[@data-pui-root][1]');
        await waitForHoverCardEndpoint(opened.page, darkPanel);
        const darkPanelSurface = await facts(darkPanel);
        const darkTriggerSurface = await facts(darkTrigger);
        const [darkTriggerBackground, darkTriggerForeground] = await Promise.all([
          resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-main']),
          resolvedThemeColors(opened.page, 'color', ['--pui-main-foreground']),
        ]).then(([background, foreground]) => [background[0], foreground[0]]);
        expect(darkTriggerSurface.backgroundColor, `${runtime}/dark/hover-trigger/background`).toBe(
          darkTriggerBackground
        );
        expect(darkTriggerSurface.color, `${runtime}/dark/hover-trigger/foreground`).toBe(
          darkTriggerForeground
        );
        expect(
          darkTriggerSurface.backgroundImage,
          `${runtime}/dark/hover-trigger/background-image`
        ).toBe('none');
        expect(
          darkTriggerSurface.backdropFilter,
          `${runtime}/dark/hover-trigger/backdrop-filter`
        ).toBe('none');
        expectSquareBorder(darkTriggerSurface, `${runtime}/dark/hover-trigger`);
        expectBorderColors(darkTriggerSurface, 'rgb(0, 0, 0)', `${runtime}/dark/hover-trigger`);
        expect(
          darkPanelSurface.backgroundImage,
          `${runtime}/dark/hover-panel/background-image`
        ).toBe('none');
        expect(
          darkPanelSurface.backdropFilter,
          `${runtime}/dark/hover-panel/backdrop-filter`
        ).toBe('none');
        expect(
          darkPanelSurface.animationDuration,
          `${runtime}/dark/hover-panel/animation-duration`
        ).toBe('0.2s');
        expectHardFrame(darkPanelSurface, '3px', 'rgb(0, 0, 0)', `${runtime}/dark/hover-panel`);
        expectBorderColors(darkPanelSurface, 'rgb(0, 0, 0)', `${runtime}/dark/hover-panel`);
        expect(darkPanelSurface.outlineColor, `${runtime}/dark/hover-panel/outline-color`).toBe(
          'rgba(0, 0, 0, 0)'
        );
        const [darkPanelBackground] = await resolvedThemeColors(opened.page, 'backgroundColor', [
          '--pui-secondary-background',
        ]);
        const [darkPanelForeground] = await resolvedThemeColors(opened.page, 'color', [
          '--pui-foreground',
        ]);
        expect(darkPanelSurface.backgroundColor, `${runtime}/dark/hover-panel/background`).toBe(
          darkPanelBackground
        );
        expect(darkPanelSurface.color, `${runtime}/dark/hover-panel/foreground`).toBe(
          darkPanelForeground
        );
        expect(
          darkPanelSurface.transitionProperty,
          `${runtime}/dark/hover-panel/transition-property`
        ).toBe('none');
        expect(
          darkPanelSurface.transitionDuration,
          `${runtime}/dark/hover-panel/transition-duration`
        ).toBe('0.2s');
        await darkTrigger.evaluate((element) => (element as HTMLElement).blur());
        await darkTrigger.dispatchEvent('pointerleave');
        await expectVisibility(darkPanelText, false, `${runtime}/dark/hover-pointer-close`);
        await applyColorScheme(opened.page, 'light');
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);
});
