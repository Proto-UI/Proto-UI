// @vitest-environment node

import type { Browser, BrowserContext, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  launchBrowser,
  startServer,
  stopServer,
  type ColorScheme,
  type RuntimeId,
} from './browser-harness';

const ROUTE = '/en/test/style-isolation/';
const VIEWPORT = { width: 1440, height: 1200 };

let browser: Browser;
let context: BrowserContext;
let page: Page;
let baseUrl = '';

async function applyStandaloneTheme(colorScheme: ColorScheme): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.evaluate((scheme) => {
    document.documentElement.dataset.theme = scheme;
  }, colorScheme);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: VIEWPORT });
  page = await context.newPage();
  await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.styleIsolationReady === 'true' ||
      document.documentElement.dataset.styleIsolationReady === 'error',
    undefined,
    { timeout: 90_000 }
  );
  const error = await page.evaluate(
    () => document.documentElement.dataset.styleIsolationError ?? null
  );
  if (error) throw new Error(`Style-isolation fixture failed to mount:\n${error}`);
}, 150_000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Prototype style closure without Website CSS', () => {
  it('loads only scoped Proto UI physical styles and mounts every real runtime', async () => {
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-NORMALIZATION-SCOPE
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-STANDALONE-FOUR-RUNTIMES
    const fixture = await page.evaluate(() => {
      const selectors: string[] = [];
      const visit = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
          const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
          if (nested) visit(nested);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        visit(sheet.cssRules);
      }

      const runtimeFacts = Object.fromEntries(
        ['wc', 'react', 'vue', 'vue2'].map((runtime) => {
          const host = document.querySelector<HTMLElement>(`[data-runtime-host="${runtime}"]`);
          const firstRoot = host?.querySelector<HTMLElement>('[data-pui-root]') ?? null;
          return [
            runtime,
            {
              mounted: host?.dataset.mounted === 'true',
              textareaCount: host?.querySelectorAll('textarea[data-pui-style]').length ?? 0,
              firstRootTag: firstRoot?.tagName ?? null,
              vue3: host?.hasAttribute('data-v-app') ?? false,
              vue2: Boolean(
                firstRoot && (firstRoot as HTMLElement & { __vue__?: unknown }).__vue__
              ),
            },
          ];
        })
      );

      return {
        selectors,
        runtimeFacts,
        hasPreviewer: Boolean(document.querySelector('[data-previewer-id]')),
        hasUnstyledProjection: document
          .querySelector('[data-unstyled-control]')
          ?.hasAttribute('data-pui-style'),
      };
    });

    expect(fixture.hasPreviewer).toBe(false);
    expect(fixture.hasUnstyledProjection).toBe(false);

    for (const selector of fixture.selectors) {
      expect(selector, 'document-wide universal selector').not.toMatch(/(^|,\s*)\*(\s*,|$)/);
      expect(selector, 'unscoped native-control selector').not.toMatch(
        /(^|,\s*)(button|input|select|textarea)(\s*,|$)/
      );
    }

    expect(fixture.selectors).toContain(
      ':where(button[data-pui-style], input[data-pui-style], select[data-pui-style], textarea[data-pui-style])'
    );
    expect(
      fixture.selectors.some(
        (selector) =>
          selector.includes('[data-pui-style]') &&
          selector.includes('[data-pui-style]::before') &&
          selector.includes('[data-pui-style]::after')
      )
    ).toBe(true);

    for (const runtime of RUNTIMES) {
      const facts = fixture.runtimeFacts[runtime] as {
        mounted: boolean;
        textareaCount: number;
        firstRootTag: string | null;
        vue3: boolean;
        vue2: boolean;
      };
      expect(facts.mounted, `${runtime}/mounted`).toBe(true);
      expect(facts.textareaCount, `${runtime}/physical-textareas`).toBe(3);

      if (runtime === 'wc') {
        expect(facts.firstRootTag, `${runtime}/owner`).toMatch(/^WC-/);
      } else if (runtime === 'vue') {
        expect(facts.vue3, `${runtime}/owner`).toBe(true);
      } else if (runtime === 'vue2') {
        expect(facts.vue2, `${runtime}/owner`).toBe(true);
      } else {
        expect(facts.firstRootTag, `${runtime}/owner`).not.toMatch(/^WC-/);
        expect(facts.vue3, `${runtime}/owner`).toBe(false);
        expect(facts.vue2, `${runtime}/owner`).toBe(false);
      }
    }
  });

  for (const colorScheme of COLOR_SCHEMES) {
    it(`keeps Textarea and Button presentation closed in ${colorScheme} mode`, async () => {
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-STANDALONE-FOUR-RUNTIMES
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-CONSUMER-INPUTS
      await applyStandaloneTheme(colorScheme);

      const result = await page.evaluate(
        (runtimeIds) => {
          const foreground = getComputedStyle(
            document.querySelector<HTMLElement>('[data-token-probe="foreground"]')!
          ).color;

          const resolveSurface = (ref: string): HTMLElement => {
            const boundary = document.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
            if (!boundary) throw new Error(`Missing fixture ref ${ref}.`);
            if (boundary.hasAttribute('data-pui-style')) return boundary;
            const surface = boundary.querySelector<HTMLElement>('[data-pui-style]');
            if (!surface) throw new Error(`Missing styled surface for ${ref}.`);
            return surface;
          };

          const runtimes = Object.fromEntries(
            runtimeIds.map((runtime) => {
              const host = document.querySelector<HTMLElement>(`[data-runtime-host="${runtime}"]`);
              if (!host) throw new Error(`Missing runtime host ${runtime}.`);
              const hostFont = getComputedStyle(host).fontFamily;
              const textareas = Array.from(
                host.querySelectorAll<HTMLTextAreaElement>('textarea[data-pui-style]')
              ).map((element) => {
                const style = getComputedStyle(element);
                return {
                  label: element.getAttribute('aria-label'),
                  value: element.value,
                  rows: element.rows,
                  disabled: element.disabled,
                  readOnly: element.readOnly,
                  boxSizing: style.boxSizing,
                  resize: style.resize,
                  fontFamily: style.fontFamily,
                  color: style.color,
                  padding: [
                    style.paddingTop,
                    style.paddingRight,
                    style.paddingBottom,
                    style.paddingLeft,
                  ],
                  borderWidth: [
                    style.borderTopWidth,
                    style.borderRightWidth,
                    style.borderBottomWidth,
                    style.borderLeftWidth,
                  ],
                  borderStyle: style.borderTopStyle,
                  borderRadius: style.borderRadius,
                  minHeight: style.minHeight,
                };
              });

              const button = getComputedStyle(resolveSurface(`button-${runtime}`));
              const override = getComputedStyle(resolveSurface(`button-override-${runtime}`));
              return [
                runtime,
                {
                  hostFont,
                  textareas,
                  button: {
                    height: button.height,
                    paddingLeft: button.paddingLeft,
                    paddingRight: button.paddingRight,
                    borderWidth: button.borderTopWidth,
                    borderStyle: button.borderTopStyle,
                    borderRadius: button.borderRadius,
                    background: button.backgroundColor,
                    color: button.color,
                    fontFamily: button.fontFamily,
                  },
                  override: {
                    color: override.color,
                    fontFamily: override.fontFamily,
                  },
                },
              ];
            })
          );
          return { foreground, runtimes };
        },
        [...RUNTIMES]
      );

      let firstButton:
        | {
            height: string;
            paddingLeft: string;
            paddingRight: string;
            borderWidth: string;
            borderStyle: string;
            borderRadius: string;
            background: string;
            color: string;
            fontFamily: string;
          }
        | undefined;

      for (const runtime of RUNTIMES) {
        const facts = result.runtimes[runtime] as {
          hostFont: string;
          textareas: Array<{
            label: string | null;
            value: string;
            rows: number;
            disabled: boolean;
            readOnly: boolean;
            boxSizing: string;
            resize: string;
            fontFamily: string;
            color: string;
            padding: string[];
            borderWidth: string[];
            borderStyle: string;
            borderRadius: string;
            minHeight: string;
          }>;
          button: NonNullable<typeof firstButton>;
          override: { color: string; fontFamily: string };
        };

        expect(facts.textareas, `${runtime}/textarea-count`).toHaveLength(3);
        for (const textarea of facts.textareas) {
          const label = `${runtime}/${textarea.label}`;
          expect(textarea.boxSizing, `${label}/box-sizing`).toBe('border-box');
          expect(textarea.resize, `${label}/resize`).toBe('vertical');
          expect(textarea.fontFamily, `${label}/consumer-font`).toBe(facts.hostFont);
          expect(textarea.color, `${label}/foreground`).toBe(result.foreground);
          expect(textarea.padding, `${label}/padding`).toEqual(['8px', '12px', '8px', '12px']);
          expect(textarea.borderWidth, `${label}/border-width`).toEqual([
            '1px',
            '1px',
            '1px',
            '1px',
          ]);
          expect(textarea.borderStyle, `${label}/border-style`).toBe('solid');
          expect(textarea.borderRadius, `${label}/radius`).toBe('8px');
          expect(textarea.minHeight, `${label}/min-height`).toBe('64px');
        }

        const [editable, disabled, readOnly] = facts.textareas;
        expect(editable).toMatchObject({
          label: 'Standalone editable',
          value: 'Standalone editable',
          rows: 4,
          disabled: false,
          readOnly: false,
        });
        expect(disabled).toMatchObject({
          label: 'Standalone disabled',
          value: 'Standalone disabled',
          rows: 2,
          disabled: true,
          readOnly: false,
        });
        expect(readOnly).toMatchObject({
          label: 'Standalone readonly',
          value: 'Standalone readonly',
          rows: 2,
          disabled: false,
          readOnly: true,
        });

        expect(facts.button.height, `${runtime}/button-height`).toBe('32px');
        expect(facts.button.paddingLeft, `${runtime}/button-padding-left`).toBe('10px');
        expect(facts.button.paddingRight, `${runtime}/button-padding-right`).toBe('10px');
        expect(facts.button.borderWidth, `${runtime}/button-border-width`).toBe('1px');
        expect(facts.button.borderStyle, `${runtime}/button-border-style`).toBe('solid');
        expect(facts.button.borderRadius, `${runtime}/button-radius`).toBe('10px');
        expect(facts.button.fontFamily, `${runtime}/button-consumer-font`).toBe(facts.hostFont);
        if (!firstButton) firstButton = facts.button;
        else expect(facts.button, `${runtime}/button-parity`).toEqual(firstButton);

        expect(facts.override.color, `${runtime}/consumer-color-override`).toBe('rgb(12, 34, 56)');
        expect(facts.override.fontFamily, `${runtime}/consumer-font-override`).toContain(
          'Proto UI Explicit Consumer'
        );
      }
    }, 120_000);

    it(`resolves Hover Card paint from Prototype tokens in ${colorScheme} mode`, async () => {
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-STANDALONE-FOUR-RUNTIMES
      await applyStandaloneTheme(colorScheme);
      await page.waitForFunction(
        (runtimeIds) =>
          runtimeIds.every((runtime) => {
            const boundary = document.querySelector<HTMLElement>(
              `[data-demo-ref="hover-content-${runtime}"]`
            );
            return Boolean(
              boundary?.hasAttribute('data-pui-style') ||
              boundary?.querySelector('[data-pui-style]')
            );
          }),
        [...RUNTIMES],
        { timeout: 20_000 }
      );
      await page.waitForTimeout(250);

      const result = await page.evaluate(
        (runtimeIds) => {
          const borderProbe = getComputedStyle(
            document.querySelector<HTMLElement>('[data-token-probe="border"]')!
          ).borderTopColor;
          const popoverProbe = getComputedStyle(
            document.querySelector<HTMLElement>('[data-token-probe="popover"]')!
          );
          const expected = {
            border: borderProbe,
            background: popoverProbe.backgroundColor,
            color: popoverProbe.color,
          };

          const readings = Object.fromEntries(
            runtimeIds.map((runtime) => {
              const boundary = document.querySelector<HTMLElement>(
                `[data-demo-ref="hover-content-${runtime}"]`
              );
              if (!boundary) throw new Error(`Missing Hover Card Content for ${runtime}.`);
              const surface = boundary.hasAttribute('data-pui-style')
                ? boundary
                : boundary.querySelector<HTMLElement>('[data-pui-style]');
              if (!surface) throw new Error(`Missing Hover Card surface for ${runtime}.`);
              const style = getComputedStyle(surface);
              return [
                runtime,
                {
                  borderWidth: style.borderTopWidth,
                  borderStyle: style.borderTopStyle,
                  borderColor: style.borderTopColor,
                  background: style.backgroundColor,
                  color: style.color,
                },
              ];
            })
          );
          return { expected, readings };
        },
        [...RUNTIMES]
      );

      for (const runtime of RUNTIMES) {
        const reading = result.readings[runtime] as {
          borderWidth: string;
          borderStyle: string;
          borderColor: string;
          background: string;
          color: string;
        };
        expect(reading.borderWidth, `${runtime}/border-width`).toBe('1px');
        expect(reading.borderStyle, `${runtime}/border-style`).toBe('solid');
        expect(reading.borderColor, `${runtime}/border-color`).toBe(result.expected.border);
        expect(reading.background, `${runtime}/background`).toBe(result.expected.background);
        expect(reading.color, `${runtime}/foreground`).toBe(result.expected.color);
      }
    }, 120_000);
  }
});
