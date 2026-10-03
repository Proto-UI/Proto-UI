// @vitest-environment node

import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../../../../packages/cli/src/services/proto-style-css';
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

const SPINNER_ROUTE = '/en/ui-libraries/brutalist/components/spinner/';
const SPINNER_SELECTOR = '[data-pui-root][data-demo-ref^="spinner-"]';
const NARROW_VIEWPORT = { width: 320, height: 844 } as const;
const requestedRuntime = process.env.PROTO_UI_SPINNER_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_SPINNER_BROWSER_RUNTIME must be one of ${RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

let browser: Browser;
let baseUrl = '';

function roots(previewer: Locator): Locator {
  return previewer.locator(`[data-projection-content] ${SPINNER_SELECTOR}`);
}

async function expectPassiveFocus(locator: Locator, label: string): Promise<void> {
  await locator.focus();
  const active = await locator.evaluate((element) => {
    const root = element.shadowRoot ?? element;
    return root.contains(document.activeElement) || document.activeElement === element;
  });
  expect(active, `${label}/focus`).toBe(false);
}

beforeAll(async () => {
  browser = await launchBrowser();
  baseUrl = await startServer(SPINNER_ROUTE);
}, 150_000);

afterAll(async () => {
  await stopServer();
  await browser.close();
}, 60_000);

describe.sequential('Brutalist Spinner documentation browser regressions', () => {
  it('matches bracket-valued token selectors and paints the same leading open edge', async () => {
    const page = await browser.newPage();
    try {
      const token = 'border-[transparent_currentColor_currentColor_currentColor]';
      const css = renderProtoStyleTokenCss(['border-2', token, 'animate-spin']);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setContent(`<!doctype html><style>${css}</style>
        <span data-control="foo" data-pui-style="border-2 foo animate-spin"></span>
        <span data-control="w-[2px]" data-pui-style="border-2 w-[2px] animate-spin"></span>
        <span data-control="${token}" data-pui-style="border-2 ${token} animate-spin"
          style="display:inline-block;width:24px;height:24px;color:rgb(40,50,60)"></span>`);
      for (const value of ['foo', 'w-[2px]', token]) {
        const element = page.locator(`[data-control="${value}"]`);
        for (const selector of [
          `[data-pui-style~="${value}"]`,
          `:where([data-pui-style~="${value}"])`,
        ]) {
          // Native matching belongs here: happy-dom 15.11.7 interpolates an
          // attribute value into a RegExp, misreading even the old w-[2px].
          expect(await element.evaluate((node, query) => node.matches(query), selector)).toBe(true);
        }
      }
      const spinner = page.locator(`[data-control="${token}"]`);
      const facts = () =>
        spinner.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            colors: [
              style.borderTopColor,
              style.borderRightColor,
              style.borderBottomColor,
              style.borderLeftColor,
            ],
            widths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            animation: style.animationName,
          };
        });
      expect(await facts()).toEqual({
        colors: ['rgba(0, 0, 0, 0)', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)'],
        widths: ['2px', '2px', '2px', '2px'],
        animation: 'pui-spin',
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await facts()).toEqual({
        colors: ['rgba(0, 0, 0, 0)', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)', 'rgb(40, 50, 60)'],
        widths: ['2px', '2px', '2px', '2px'],
        animation: 'none',
      });
    } finally {
      await page.close();
    }
  });

  it('applies combined dark reduced-motion CSS only when both conditions hold', async () => {
    const page = await browser.newPage();
    try {
      // A consumer animation in a lower layer must survive unless the exact
      // authored dark + reduced-motion target applies. This also tests an
      // explicit light theme overriding the system dark preference.
      const css = renderProtoStyleTokenCss(['dark:motion-reduce:animate-none']);
      for (const theme of ['system', 'dark', 'light'] as const) {
        for (const colorScheme of COLOR_SCHEMES) {
          for (const reducedMotion of ['no-preference', 'reduce'] as const) {
            await page.emulateMedia({ colorScheme, reducedMotion });
            const themeAttribute = theme === 'system' ? '' : `data-theme="${theme}"`;
            await page.setContent(`<!doctype html><html ${themeAttribute}><head><style>
              @layer baseline, proto-ui;
              @keyframes consumer-spin { to { transform: rotate(360deg); } }
              @layer baseline { div { animation: consumer-spin 1s linear infinite; } }
              ${css}
            </style></head><body><div data-pui-style="dark:motion-reduce:animate-none"></div></body></html>`);
            const effectiveDark =
              theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
            expect(
              await page
                .locator('div')
                .evaluate((element) => getComputedStyle(element).animationName),
              `${theme}/${colorScheme}/${reducedMotion}`
            ).toBe(effectiveDark && reducedMotion === 'reduce' ? 'none' : 'consumer-spin');
          }
        }
      }
    } finally {
      await page.close();
    }
  });

  it('keeps Spinner contentless, hidden, circular, and open-edged across runtimes and themes', async () => {
    const opened = await openRoute(browser, baseUrl, SPINNER_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, SPINNER_SELECTOR, 5);
        for (const colorScheme of COLOR_SCHEMES) {
          await applyColorScheme(opened.page, colorScheme);
          const spinners = roots(opened.previewer);
          const allFacts = await spinners.evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element);
              return {
                role: element.getAttribute('role'),
                ariaHidden: element.getAttribute('aria-hidden'),
                ariaLive: element.getAttribute('aria-live'),
                ariaBusy: element.getAttribute('aria-busy'),
                tabIndex: (element as HTMLElement).tabIndex,
                textContent: (element.shadowRoot ?? element).textContent?.trim() ?? '',
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
                color: style.color,
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
                boxShadow: style.boxShadow,
                layoutWidth: style.width,
                layoutHeight: style.height,
              };
            })
          );

          expect(
            await opened.previewer.locator('[data-demo-ref="spinner-canary"]').count(),
            `${runtime}/spinner-content`
          ).toBe(0);

          // Admission requires both parent compositions; Spinner owns neither
          // the region's busy fact nor the Button's accessible action name.
          const busy = opened.previewer.locator(
            '[data-projection-content] [data-demo-ref="busy-region"]'
          );
          expect(await busy.getAttribute('aria-busy'), `${runtime}/parent-busy`).toBe('true');
          expect(await busy.locator(SPINNER_SELECTOR).count(), `${runtime}/inside-busy`).toBe(1);
          expect(await busy.textContent(), `${runtime}/parent-loading-text`).toContain(
            'Loading results…'
          );
          const button = opened.previewer.getByRole('button', { name: 'Saving…', exact: true });
          expect(await button.locator(SPINNER_SELECTOR).count(), `${runtime}/inside-button`).toBe(
            1
          );
          await button.focus();
          expect(
            await button.evaluate((element) => document.activeElement === element),
            `${runtime}/parent-focus`
          ).toBe(true);

          expect(allFacts.length, `${runtime}/count`).toBe(5);
          for (const [index, surface] of allFacts.entries()) {
            const label = `${runtime}/spinner-${index}`;
            expect(surface.role, `${label}/role`).toBeNull();
            expect(surface.ariaHidden, `${label}/hidden`).toBe('true');
            expect(surface.ariaLive, `${label}/live`).toBeNull();
            expect(surface.ariaBusy, `${label}/busy`).toBeNull();
            expect(surface.tabIndex, `${label}/tabindex`).toBe(-1);
            await expectPassiveFocus(spinners.nth(index), label);
            expect(surface.textContent.includes('SPINNER-CANARY'), `${label}/contentless`).toBe(
              false
            );
            // Square geometry from the size prop (sm/md/lg/default md/inline sm).
            expect(surface.layoutWidth, `${label}/width`).toBe(
              ['16px', '24px', '32px', '24px', '16px'][index]
            );
            expect(surface.layoutHeight, `${label}/height`).toBe(
              ['16px', '24px', '32px', '24px', '16px'][index]
            );
            // Open-edge ring: three solid 2px edges, one transparent.
            expect(surface.borderWidths, `${label}/border-widths`).toEqual(Array(4).fill('2px'));
            const transparentEdges = surface.borderColors.filter(
              (color) => color === 'rgba(0, 0, 0, 0)'
            ).length;
            expect(transparentEdges, `${label}/open-edge`).toBe(1);
            expect(
              surface.borderColors.filter((color) => color !== 'rgba(0, 0, 0, 0)'),
              `${label}/inherited-currentColor`
            ).toEqual(Array(3).fill(surface.color));
            // The circular silhouette has no fill or soft effects.
            expect(surface.borderRadii, `${label}/radius`).toEqual(Array(4).fill('9999px'));
            expect(surface.backgroundImage, `${label}/no-fill-image`).toBe('none');
            expect(surface.boxShadow, `${label}/no-shadow`).toBe('none');
          }
        }
      }
    } finally {
      await opened.context.close();
    }
  }, 240_000);

  it('rotates 1000ms linear infinite by default and stays open-edged under reduced motion', async () => {
    const opened = await openRoute(browser, baseUrl, SPINNER_ROUTE, NARROW_VIEWPORT);
    try {
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(opened.page, opened.previewer, runtime, SPINNER_SELECTOR, 5);
        const first = roots(opened.previewer).first();
        const motionFacts = await first.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationTimingFunction: style.animationTimingFunction,
            animationIterationCount: style.animationIterationCount,
          };
        });
        expect(motionFacts.animationName, `${runtime}/rotation`).toBe('pui-spin');
        expect(motionFacts.animationDuration, `${runtime}/duration`).toBe('1s');
        expect(motionFacts.animationTimingFunction, `${runtime}/timing`).toBe('linear');
        expect(motionFacts.animationIterationCount, `${runtime}/iteration`).toBe('infinite');

        await opened.page.emulateMedia({ reducedMotion: 'reduce' });
        const reducedFacts = await first.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            animationName: style.animationName,
            borderColors: [
              style.borderTopColor,
              style.borderRightColor,
              style.borderBottomColor,
              style.borderLeftColor,
            ],
          };
        });
        expect(reducedFacts.animationName, `${runtime}/reduced-animation`).toBe('none');
        expect(
          reducedFacts.borderColors.filter((color) => color === 'rgba(0, 0, 0, 0)').length,
          `${runtime}/reduced-open-edge`
        ).toBe(1);
        await opened.page.emulateMedia({ reducedMotion: null });
      }
    } finally {
      await opened.context.close();
    }
  }, 120_000);
});
