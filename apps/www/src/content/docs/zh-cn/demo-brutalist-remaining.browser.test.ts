// @vitest-environment node

import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  applyColorScheme,
  choosePreviewRuntime,
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
const NARROW_VIEWPORT = { width: 320, height: 844 } as const;
const BROWSER_RUNTIMES = ['wc', 'react', 'vue'] as const;
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
  borderWidth: string;
  borderRadius: string;
  backgroundColor: string;
  boxShadow: string;
  display: string;
  flexDirection: string;
  fontFamily: string;
  textTransform: string;
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
      borderWidth: style.borderTopWidth,
      borderRadius: style.borderTopLeftRadius,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      display: style.display,
      flexDirection: style.flexDirection,
      fontFamily: style.fontFamily,
      textTransform: style.textTransform,
      width: style.width,
      height: style.height,
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

async function selectRuntimeWithDiagnostics(
  page: import('playwright-core').Page,
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
  baseUrl = await startServer(BADGE_ROUTE);
  browser = await launchBrowser();
}, 180_000);

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
        const badges = roots(opened.previewer);
        const allFacts = await badges.evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            return {
              role: element.getAttribute('role'),
              tabIndex: (element as HTMLElement).tabIndex,
              borderWidth: style.borderTopWidth,
              borderRadius: style.borderTopLeftRadius,
              backgroundColor: style.backgroundColor,
              boxShadow: style.boxShadow,
              fontFamily: style.fontFamily,
              textTransform: style.textTransform,
            };
          })
        );

        expect(new Set(allFacts.map((surface) => surface.backgroundColor)).size, runtime).toBe(3);
        for (const [index, surface] of allFacts.entries()) {
          const label = `${runtime}/badge-${index}`;
          expect(surface.role, `${label}/role`).toBeNull();
          expect(surface.tabIndex, `${label}/tabindex`).toBe(-1);
          expect(surface.borderWidth, `${label}/border`).toBe('2px');
          expect(surface.borderRadius, `${label}/radius`).toBe('0px');
          expect(surface.boxShadow, `${label}/shadow`).toContain('2px 2px 0px 0px');
          expect(surface.fontFamily.toLowerCase(), `${label}/font`).toMatch(/mono|monospace/);
          expect(surface.textTransform, `${label}/case`).toBe('uppercase');
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
        const card = roots(opened.previewer).first();
        const surface = await facts(card);
        expectHardFrame(surface, '6px', `${runtime}/card`);
        expect(surface.display, `${runtime}/card/display`).toBe('flex');
        expect(surface.flexDirection, `${runtime}/card/direction`).toBe('column');
        expect(surface.backgroundColor, `${runtime}/card/background`).not.toBe('rgba(0, 0, 0, 0)');
        expect(surface.role, `${runtime}/card/role`).toBeNull();
        expect(surface.tabIndex, `${runtime}/card/tabindex`).toBe(-1);
        expect(Number.parseFloat(surface.width), `${runtime}/card/width`).toBeGreaterThan(0);
        expect(Number.parseFloat(surface.height), `${runtime}/card/height`).toBeGreaterThan(0);
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('keeps Separator orientation and two-pixel hard-line geometry across themes', async () => {
    const opened = await openRoute(browser, baseUrl, SEPARATOR_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntimeWithDiagnostics(
          opened.page,
          opened.previewer,
          runtime,
          '[data-pui-root]',
          2
        );
        const separators = roots(opened.previewer);
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(opened.page, colorScheme);
          const allFacts = await separators.evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element);
              return {
                orientation: element.getAttribute('data-orientation'),
                width: style.width,
                height: style.height,
                backgroundColor: style.backgroundColor,
              };
            })
          );
          expect(
            allFacts.map((surface) => surface.orientation),
            `${runtime}/${colorScheme}`
          ).toEqual(['horizontal', 'vertical']);
          expect(allFacts[0].height, `${runtime}/${colorScheme}/horizontal-thickness`).toBe('2px');
          expect(
            Number.parseFloat(allFacts[0].width),
            `${runtime}/${colorScheme}/horizontal-length`
          ).toBeGreaterThan(0);
          expect(allFacts[1].width, `${runtime}/${colorScheme}/vertical-thickness`).toBe('2px');
          expect(
            Number.parseFloat(allFacts[1].height),
            `${runtime}/${colorScheme}/vertical-length`
          ).toBeGreaterThan(0);
          expect(
            allFacts.every((surface) => surface.backgroundColor !== 'rgba(0, 0, 0, 0)'),
            `${runtime}/${colorScheme}/ink`
          ).toBe(true);
        }
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('keeps Skeleton contentless, hidden, and dimensioned by its consumer', async () => {
    const opened = await openRoute(browser, baseUrl, SKELETON_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, '[data-pui-root]', 3);
        const skeletons = roots(opened.previewer);
        const allFacts = await skeletons.evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            return {
              role: element.getAttribute('role'),
              ariaHidden: element.getAttribute('aria-hidden'),
              tabIndex: (element as HTMLElement).tabIndex,
              text: element.textContent,
              borderWidth: style.borderTopWidth,
              borderRadius: style.borderTopLeftRadius,
              backgroundColor: style.backgroundColor,
              boxShadow: style.boxShadow,
              width: style.width,
              height: style.height,
            };
          })
        );
        for (const [index, surface] of allFacts.entries()) {
          const label = `${runtime}/skeleton-${index}`;
          expect(surface.role, `${label}/role`).toBeNull();
          expect(surface.ariaHidden, `${label}/hidden`).toBe('true');
          expect(surface.tabIndex, `${label}/tabindex`).toBe(-1);
          expect(surface.text, `${label}/content`).toBe('');
          expect(surface.borderWidth, `${label}/border`).toBe('2px');
          expect(surface.borderRadius, `${label}/radius`).toBe('0px');
          expect(surface.backgroundColor, `${label}/background`).not.toBe('rgba(0, 0, 0, 0)');
          expect(surface.boxShadow, `${label}/shadow`).toContain('2px 2px 0px 0px');
          expect(Number.parseFloat(surface.width), `${label}/width`).toBeGreaterThan(0);
          expect(Number.parseFloat(surface.height), `${label}/height`).toBeGreaterThan(0);
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
              borderRadius: style.borderTopLeftRadius,
              boxShadow: style.boxShadow,
              backgroundColor: style.backgroundColor,
            };
          })
        );
        expect(
          factsBefore.map((surface) => surface.pressed),
          runtime
        ).toEqual(['false', 'true', 'false', 'false']);
        expect(
          factsBefore.map((surface) => surface.disabled),
          runtime
        ).toEqual(['false', 'false', 'false', 'true']);
        expect(
          new Set(factsBefore.map((surface) => surface.backgroundColor)).size,
          runtime
        ).toBeGreaterThan(1);
        for (const [index, surface] of factsBefore.entries()) {
          expect(surface.role, `${runtime}/toggle-${index}/role`).toBe('button');
          expect(surface.borderWidth, `${runtime}/toggle-${index}/border`).toBe('2px');
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
        await first.click();
        expect(
          await first.getAttribute('aria-pressed'),
          `${runtime}/first-enabled-after-second-click`
        ).toBe('false');
        const disabled = toggles.nth(3);
        expect(
          await disabled.evaluate((element) => getComputedStyle(element).pointerEvents),
          `${runtime}/disabled-pointer-events`
        ).toBe('none');
        expect(
          await disabled.evaluate((element) => getComputedStyle(element).opacity),
          `${runtime}/disabled-opacity`
        ).toBe('0.5');
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);

  it('opens Hover Card from pointer and focus while preserving square trigger and panel surfaces', async () => {
    const opened = await openRoute(browser, baseUrl, HOVER_CARD_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await choosePreviewRuntime(opened.page, opened.previewer, runtime);
        await opened.page.waitForFunction(
          () => document.querySelectorAll('[data-previewer-id] .host [data-pui-root]').length >= 2,
          undefined,
          { timeout: 20_000 }
        );
        const nodes = opened.previewer.locator('.host [data-pui-root]');
        const trigger = nodes.nth(1);
        const panelText = opened.page
          .getByText('A square hard-shadowed preview panel.', { exact: true })
          .last();
        const triggerSurface = await facts(trigger);
        expectHardFrame(triggerSurface, '3px', `${runtime}/hover-trigger`);
        expect(triggerSurface.role, `${runtime}/hover-trigger/role`).toBeNull();
        expect(triggerSurface.tabIndex, `${runtime}/hover-trigger/tabindex`).toBeGreaterThanOrEqual(
          0
        );

        await trigger.hover();
        await expectVisibility(panelText, true, `${runtime}/hover-pointer-open`);
        const panel = panelText.locator('xpath=ancestor-or-self::*[@data-pui-root][1]');
        expectHardFrame(await facts(panel), '3px', `${runtime}/hover-panel`);

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
      }
    } finally {
      await opened.context.close();
    }
  }, 180_000);
});
