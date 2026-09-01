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
  borderWidth: string;
  borderColor: string;
  borderRadius: string;
  backgroundColor: string;
  color: string;
  boxShadow: string;
  outlineStyle: string;
  outlineWidth: string;
  outlineOffset: string;
  transitionProperty: string;
  transitionDuration: string;
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
      borderWidth: style.borderTopWidth,
      borderColor: style.borderTopColor,
      borderRadius: style.borderTopLeftRadius,
      backgroundColor: style.backgroundColor,
      color: style.color,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      boxShadow: style.boxShadow,
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

function expectHardFrame(surface: SurfaceFacts, shadowOffset: string, label: string): void {
  expect(surface.borderWidth, `${label}/border`).toBe('2px');
  expect(surface.borderRadius, `${label}/radius`).toBe('0px');
  expect(surface.boxShadow, `${label}/shadow`).toContain(`${shadowOffset} ${shadowOffset} 0px 0px`);
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
                borderWidth: style.borderTopWidth,
                borderColor: style.borderTopColor,
                borderRadius: style.borderTopLeftRadius,
                backgroundColor: style.backgroundColor,
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
            allFacts.every((surface) => surface.borderColor === expectedBorder),
            `${runtime}/border-pair`
          ).toBe(true);
          for (const [index, surface] of allFacts.entries()) {
            const label = `${runtime}/badge-${index}`;
            expect(surface.role, `${label}/role`).toBeNull();
            expect(surface.tabIndex, `${label}/tabindex`).toBe(-1);
            expect(surface.ariaSelected, `${label}/aria-selected`).toBeNull();
            expect(surface.ariaPressed, `${label}/aria-pressed`).toBeNull();
            expect(surface.ariaLive, `${label}/aria-live`).toBeNull();
            expect(surface.borderWidth, `${label}/border`).toBe('2px');
            expect(surface.borderRadius, `${label}/radius`).toBe('0px');
            expect(surface.boxShadow, `${label}/shadow`).toContain('2px 2px 0px 0px');
            expect(surface.fontFamily.toLowerCase(), `${label}/font`).toMatch(/mono|monospace/);
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
          expectHardFrame(surface, '6px', `${runtime}/${colorScheme}/card`);
          const [expectedBackground, expectedForeground, expectedBorder] = await Promise.all([
            resolvedThemeColors(opened.page, 'backgroundColor', ['--pui-background']),
            resolvedThemeColors(opened.page, 'color', ['--pui-foreground']),
            resolvedThemeColors(opened.page, 'borderTopColor', ['--pui-foreground']),
          ]).then(([background, foreground, border]) => [background[0], foreground[0], border[0]]);
          expect(surface.backgroundColor, `${runtime}/${colorScheme}/card/background`).toBe(
            expectedBackground
          );
          expect(surface.color, `${runtime}/${colorScheme}/card/foreground`).toBe(
            expectedForeground
          );
          expect(surface.borderColor, `${runtime}/${colorScheme}/card/border-color`).toBe(
            expectedBorder
          );
          expect(surface.display, `${runtime}/${colorScheme}/card/display`).toBe('flex');
          expect(surface.flexDirection, `${runtime}/${colorScheme}/card/direction`).toBe('column');
          expect(surface.role, `${runtime}/${colorScheme}/card/role`).toBeNull();
          expect(surface.tabIndex, `${runtime}/${colorScheme}/card/tabindex`).toBe(-1);
          expect(surface.ariaSelected, `${runtime}/${colorScheme}/card/aria-selected`).toBeNull();
          expect(surface.ariaPressed, `${runtime}/${colorScheme}/card/aria-pressed`).toBeNull();
          expect(surface.ariaLive, `${runtime}/${colorScheme}/card/aria-live`).toBeNull();
          expect(surface.ariaBusy, `${runtime}/${colorScheme}/card/aria-busy`).toBeNull();
          expect(surface.hasActiveState, `${runtime}/${colorScheme}/card/data-active`).toBe(false);
          expect(surface.hasPressedState, `${runtime}/${colorScheme}/card/data-pressed`).toBe(
            false
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
                borderWidth: style.borderTopWidth,
                borderColor: style.borderTopColor,
                borderRadius: style.borderTopLeftRadius,
                backgroundColor: style.backgroundColor,
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
            expect(surface.ariaSelected, `${label}/aria-selected`).toBeNull();
            expect(surface.ariaPressed, `${label}/aria-pressed`).toBeNull();
            expect(surface.ariaLive, `${label}/aria-live`).toBeNull();
            expect(surface.ariaBusy, `${label}/aria-busy`).toBeNull();
            expect(surface.borderWidth, `${label}/border`).toBe('2px');
            expect(surface.borderColor, `${label}/border-color`).toBe(expectedBorder);
            expect(surface.borderRadius, `${label}/radius`).toBe('0px');
            expect(surface.backgroundColor, `${label}/background`).toBe(expectedBackground);
            expect(surface.animationName, `${label}/animation`).toBe('none');
            expect(surface.animationDuration, `${label}/animation-duration`).toBe('0s');
            expect(surface.transitionProperty, `${label}/transition-property`).toBe('all');
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
              borderWidth: style.borderTopWidth,
              borderColor: style.borderTopColor,
              borderRadius: style.borderTopLeftRadius,
              boxShadow: style.boxShadow,
              backgroundColor: style.backgroundColor,
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
          new Set(factsBefore.map((surface) => surface.backgroundColor)).size,
          runtime
        ).toBeGreaterThan(1);
        for (const [index, surface] of factsBefore.entries()) {
          expect(surface.role, `${runtime}/toggle-${index}/role`).toBe('button');
          expect(surface.borderWidth, `${runtime}/toggle-${index}/border`).toBe('2px');
          expect(surface.borderColor, `${runtime}/toggle-${index}/border-color`).toBe(
            'rgb(0, 0, 0)'
          );
          expect(surface.borderRadius, `${runtime}/toggle-${index}/radius`).toBe('0px');
          expect(surface.boxShadow, `${runtime}/toggle-${index}/shadow`).toContain(
            '3px 3px 0px 0px'
          );
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
            return { backgroundColor: style.backgroundColor, color: style.color };
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
        await opened.page.mouse.move(5, 5);
        await selectRuntimeWithDiagnostics(
          opened.page,
          opened.previewer,
          runtime,
          '[data-pui-root]',
          3
        );
        const nodes = opened.previewer.locator('.host [data-pui-root]');
        const trigger = nodes.nth(1);
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
        expect(triggerSurface.borderColor, `${runtime}/hover-trigger/border-color`).toBe(
          'rgb(0, 0, 0)'
        );
        expect(triggerSurface.fontWeight, `${runtime}/hover-trigger/weight`).toBe('700');
        expect(triggerSurface.textTransform, `${runtime}/hover-trigger/case`).toBe('uppercase');
        expectHardFrame(triggerSurface, '3px', `${runtime}/hover-trigger`);
        expect(triggerSurface.role, `${runtime}/hover-trigger/role`).toBeNull();
        expect(triggerSurface.tabIndex, `${runtime}/hover-trigger/tabindex`).toBeGreaterThanOrEqual(
          0
        );

        await trigger.hover();
        await expectVisibility(panelText, true, `${runtime}/hover-pointer-open`);
        const panel = panelText.locator('xpath=ancestor-or-self::*[@data-pui-root][1]');
        // Wait for the React adapter's reveal transition to finish before
        // asserting the stable endpoint. The adapter sets
        // data-pui-view-revealing during mount and removes it after layout.
        await panel.waitFor({ state: 'visible', timeout: 10_000 });
        await opened.page.waitForFunction(
          (el) => !el?.hasAttribute('data-pui-view-revealing'),
          await panel.elementHandle(),
          { timeout: 10_000 }
        );
        const panelSurface = await facts(panel);
        const [expectedPanelBackground] = await resolvedThemeColors(
          opened.page,
          'backgroundColor',
          ['--pui-secondary-background']
        );
        const [expectedPanelForeground] = await resolvedThemeColors(opened.page, 'color', [
          '--pui-foreground',
        ]);
        expectHardFrame(panelSurface, '3px', `${runtime}/hover-panel`);
        expect(panelSurface.backgroundColor, `${runtime}/hover-panel/background`).toBe(
          expectedPanelBackground
        );
        expect(panelSurface.color, `${runtime}/hover-panel/foreground`).toBe(
          expectedPanelForeground
        );
        expect(panelSurface.borderColor, `${runtime}/hover-panel/border-color`).toBe(
          'rgb(0, 0, 0)'
        );
        expect(panelSurface.width, `${runtime}/hover-panel/width`).toBe('256px');
        expect(panelSurface.padding, `${runtime}/hover-panel/padding`).toBe('16px');
        expect(panelSurface.fontSize, `${runtime}/hover-panel/font-size`).toBe('14px');
        expect(panelSurface.lineHeight, `${runtime}/hover-panel/line-height`).toBe('24px');
        expect(panelSurface.outlineStyle, `${runtime}/hover-panel/outline-style`).toBe('solid');
        expect(panelSurface.outlineWidth, `${runtime}/hover-panel/outline-width`).toBe('2px');
        expect(panelSurface.outlineOffset, `${runtime}/hover-panel/outline-offset`).toBe('2px');
        expect(panelSurface.transitionProperty, `${runtime}/hover-panel/transition-property`).toBe(
          'none'
        );
        expect(panelSurface.transitionDuration, `${runtime}/hover-panel/transition-duration`).toBe(
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
        await darkPanel.waitFor({ state: 'visible', timeout: 10_000 });
        await opened.page.waitForFunction(
          (el) => !el?.hasAttribute('data-pui-view-revealing'),
          await darkPanel.elementHandle(),
          { timeout: 10_000 }
        );
        const darkPanelSurface = await facts(darkPanel);
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
