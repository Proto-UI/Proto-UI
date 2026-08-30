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
} from './browser-harness';

const ROUTE = '/en/test/style-isolation/';
const VIEWPORT = { width: 1440, height: 1200 };

let browser: Browser;
let context: BrowserContext;
let page: Page;
let baseUrl = '';

async function openStandaloneTheme(colorScheme: ColorScheme): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.goto(`${baseUrl}${ROUTE}?theme=${colorScheme}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.styleIsolationReady === 'true' ||
      document.documentElement.dataset.styleIsolationReady === 'error',
    undefined,
    { timeout: 90_000 }
  );
  const fixture = await page.evaluate(() => ({
    error: document.documentElement.dataset.styleIsolationError ?? null,
    theme: document.documentElement.dataset.theme ?? null,
  }));
  if (fixture.error) throw new Error(`Style-isolation fixture failed to mount:\n${fixture.error}`);
  expect(fixture.theme, 'consumer theme must be active before Adapter mount').toBe(colorScheme);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  // Textarea and Button intentionally transition color for 150ms. This suite
  // verifies stable endpoints, not an arbitrary in-flight interpolation.
  await page.waitForTimeout(200);
}

type TokenPaint = {
  foreground: string;
  background: string;
  border: string;
  inputBackground: string;
  inputBorder: string;
  transparentBackground: string;
  popoverBackground: string;
  popoverForeground: string;
};

async function readTokenPaint(): Promise<TokenPaint> {
  return page.evaluate(() => {
    const style = (name: string) => {
      const probe = document.querySelector<HTMLElement>(`[data-token-probe="${name}"]`);
      if (!probe) throw new Error(`Missing token probe ${name}.`);
      return getComputedStyle(probe);
    };
    const foreground = style('foreground');
    const background = style('background');
    const border = style('border');
    const input = style('input');
    const transparent = style('transparent');
    const popover = style('popover');
    return {
      foreground: foreground.color,
      background: background.backgroundColor,
      border: border.borderTopColor,
      inputBackground: input.backgroundColor,
      inputBorder: input.borderTopColor,
      transparentBackground: transparent.backgroundColor,
      popoverBackground: popover.backgroundColor,
      popoverForeground: popover.color,
    };
  });
}

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: VIEWPORT });
  page = await context.newPage();
  await openStandaloneTheme('light');
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

      const normalizationSensitiveStyle = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          font: style.font,
          fontFeatureSettings: style.fontFeatureSettings,
          fontVariationSettings: style.fontVariationSettings,
          letterSpacing: style.letterSpacing,
          color: style.color,
          margin: style.margin,
          padding: style.padding,
          border: style.border,
          background: style.background,
          opacity: style.opacity,
        };
      };
      const unstyled = document.querySelector<HTMLElement>('[data-unstyled-control]');
      const baseline = document
        .querySelector<HTMLIFrameElement>('[data-unstyled-baseline]')
        ?.contentDocument?.querySelector<HTMLElement>('[data-baseline-control]');

      return {
        selectors,
        runtimeFacts,
        hasPreviewer: Boolean(document.querySelector('[data-previewer-id]')),
        hasUnstyledProjection: unstyled?.hasAttribute('data-pui-style'),
        unstyledStyle: unstyled ? normalizationSensitiveStyle(unstyled) : null,
        baselineStyle: baseline ? normalizationSensitiveStyle(baseline) : null,
      };
    });

    expect(fixture.hasPreviewer).toBe(false);
    expect(fixture.hasUnstyledProjection).toBe(false);
    expect(fixture.unstyledStyle, 'unstyled control must exist').not.toBeNull();
    expect(fixture.baselineStyle, 'UA-only baseline control must exist').not.toBeNull();
    expect(fixture.unstyledStyle, 'unstyled control must retain the UA baseline').toEqual(
      fixture.baselineStyle
    );

    for (const selector of fixture.selectors) {
      expect(selector, 'document-wide universal selector').not.toMatch(/(^|,\s*)\*(\s*,|$)/);
      const nativeControl = /(^|[\s>+~,(])(button|input|select|textarea)(?![\w-])/g;
      for (const match of selector.matchAll(nativeControl)) {
        const prefixLength = match[1]?.length ?? 0;
        const tagLength = match[2].length;
        const suffix = selector.slice((match.index ?? 0) + prefixLength + tagLength);
        expect(
          suffix.startsWith('[data-pui-style]'),
          `unscoped native-control selector: ${selector}`
        ).toBe(true);
      }
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
      expect(facts.textareaCount, `${runtime}/physical-textareas`).toBe(4);

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

  it('activates distinct Light and Dark token endpoints', async () => {
    await openStandaloneTheme('light');
    const light = await readTokenPaint();
    await openStandaloneTheme('dark');
    const dark = await readTokenPaint();

    expect(light.foreground, 'foreground theme delta').not.toBe(dark.foreground);
    expect(light.background, 'background theme delta').not.toBe(dark.background);
    expect(light.border, 'border theme delta').not.toBe(dark.border);
    expect(light.inputBackground, 'input background theme delta').not.toBe(dark.inputBackground);
    expect(light.inputBorder, 'input border theme delta').not.toBe(dark.inputBorder);
    expect(light.popoverBackground, 'popover theme delta').not.toBe(dark.popoverBackground);
    expect(light.popoverForeground, 'popover foreground theme delta').not.toBe(
      dark.popoverForeground
    );
    expect(
      await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
      }))
    ).toEqual({ theme: 'dark', colorScheme: 'dark' });
  });

  for (const colorScheme of COLOR_SCHEMES) {
    it(`keeps Textarea and Button presentation closed in ${colorScheme} mode`, async () => {
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-STANDALONE-FOUR-RUNTIMES
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-CONSUMER-INPUTS
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-CASCADE-LAYER-OWNERSHIP
      // T-WEB-STYLE-BASELINE-0001-CASE-CASCADE-OWNERSHIP
      await openStandaloneTheme(colorScheme);
      const expectedButton = await readTokenPaint();

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
                  role: element.getAttribute('role'),
                  ariaDisabled: element.getAttribute('aria-disabled'),
                  ariaReadOnly: element.getAttribute('aria-readonly'),
                  tabIndex: element.tabIndex,
                  tabIndexAttribute: element.getAttribute('tabindex'),
                  value: element.value,
                  rows: element.rows,
                  disabled: element.disabled,
                  readOnly: element.readOnly,
                  boxSizing: style.boxSizing,
                  resize: style.resize,
                  fontFamily: style.fontFamily,
                  color: style.color,
                  background: style.backgroundColor,
                  opacity: style.opacity,
                  cursor: style.cursor,
                  margin: [
                    style.marginTop,
                    style.marginRight,
                    style.marginBottom,
                    style.marginLeft,
                  ],
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
                  borderColor: style.borderTopColor,
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
                    borderColor: button.borderTopColor,
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
            borderColor: string;
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
            role: string | null;
            ariaDisabled: string | null;
            ariaReadOnly: string | null;
            tabIndex: number;
            tabIndexAttribute: string | null;
            value: string;
            rows: number;
            disabled: boolean;
            readOnly: boolean;
            boxSizing: string;
            resize: string;
            fontFamily: string;
            color: string;
            background: string;
            opacity: string;
            cursor: string;
            margin: string[];
            padding: string[];
            borderWidth: string[];
            borderStyle: string;
            borderColor: string;
            borderRadius: string;
            minHeight: string;
          }>;
          button: NonNullable<typeof firstButton>;
          override: { color: string; fontFamily: string };
        };

        expect(facts.textareas, `${runtime}/textarea-count`).toHaveLength(4);
        for (const textarea of facts.textareas) {
          const label = `${runtime}/${textarea.label}`;
          expect(textarea.resize, `${label}/resize`).toBe('vertical');
          if (textarea.label !== 'Standalone consumer override') {
            expect(textarea.boxSizing, `${label}/box-sizing`).toBe('border-box');
            expect(textarea.fontFamily, `${label}/consumer-font`).toBe(facts.hostFont);
            expect(textarea.color, `${label}/foreground`).toBe(result.foreground);
            expect(textarea.background, `${label}/background`).toBe(
              colorScheme === 'dark'
                ? expectedButton.inputBackground
                : expectedButton.transparentBackground
            );
            expect(textarea.margin, `${label}/margin`).toEqual(['0px', '0px', '0px', '0px']);
            expect(textarea.padding, `${label}/padding`).toEqual(['8px', '12px', '8px', '12px']);
            expect(textarea.borderWidth, `${label}/border-width`).toEqual([
              '1px',
              '1px',
              '1px',
              '1px',
            ]);
            expect(textarea.borderStyle, `${label}/border-style`).toBe('solid');
            expect(textarea.borderColor, `${label}/border-color`).toBe(expectedButton.inputBorder);
          }
          expect(textarea.borderRadius, `${label}/radius`).toBe('8px');
          expect(textarea.minHeight, `${label}/min-height`).toBe('64px');
          expect(textarea.role, `${label}/role`).toBe('textbox');
          expect(textarea.ariaDisabled, `${label}/aria-disabled`).toBe(String(textarea.disabled));
          expect(textarea.ariaReadOnly, `${label}/aria-readonly`).toBe(String(textarea.readOnly));
          expect(textarea.tabIndexAttribute, `${label}/tab-index-projection`).toBe(
            String(textarea.tabIndex)
          );
        }

        const [editable, disabled, readOnly, consumerOverride] = facts.textareas;
        expect(editable).toMatchObject({
          label: 'Standalone editable',
          value: 'Standalone editable',
          rows: 4,
          disabled: false,
          readOnly: false,
          tabIndex: 0,
          tabIndexAttribute: '0',
          opacity: '1',
        });
        expect(disabled).toMatchObject({
          label: 'Standalone disabled',
          value: 'Standalone disabled',
          rows: 2,
          disabled: true,
          readOnly: false,
          tabIndex: -1,
          tabIndexAttribute: '-1',
          opacity: '0.5',
          cursor: 'not-allowed',
        });
        expect(readOnly).toMatchObject({
          label: 'Standalone readonly',
          value: 'Standalone readonly',
          rows: 2,
          disabled: false,
          readOnly: true,
          tabIndex: 0,
          tabIndexAttribute: '0',
          opacity: '1',
        });
        expect(disabled.cursor, `${runtime}/disabled-cursor-delta`).not.toBe(editable.cursor);
        expect(consumerOverride).toMatchObject({
          label: 'Standalone consumer override',
          value: 'Standalone consumer override',
          rows: 2,
          disabled: false,
          readOnly: false,
          boxSizing: 'content-box',
          background: 'rgb(23, 45, 67)',
          color: 'rgb(210, 220, 230)',
          opacity: '0.75',
          margin: ['4px', '6px', '4px', '6px'],
          padding: ['5px', '7px', '5px', '7px'],
          borderWidth: ['3px', '3px', '3px', '3px'],
          borderStyle: 'dashed',
          borderColor: 'rgb(89, 67, 45)',
        });
        expect(consumerOverride.fontFamily, `${runtime}/native-consumer-font-override`).toContain(
          'Proto UI Native Consumer Override'
        );

        const editableSelector = `[data-runtime-host="${runtime}"] textarea[aria-label="Standalone editable"]`;
        const editableSurface = page.locator(editableSelector);
        const readFocusPaint = () =>
          editableSurface.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              active: document.activeElement === element,
              borderColor: style.borderTopColor,
              boxShadow: style.boxShadow,
              transitionDuration: style.transitionDuration,
              transitionProperty: style.transitionProperty,
            };
          });

        const unfocused = await readFocusPaint();
        await editableSurface.focus();
        await page.waitForTimeout(220);
        const focused = await readFocusPaint();
        await page.waitForTimeout(60);

        expect(focused.active, `${runtime}/focus-active`).toBe(true);
        expect(focused.borderColor, `${runtime}/focus-border-delta`).not.toBe(
          unfocused.borderColor
        );
        expect(focused.boxShadow, `${runtime}/focus-ring-delta`).not.toBe(unfocused.boxShadow);
        expect(focused.transitionProperty, `${runtime}/focus-transition-property`).toContain(
          'box-shadow'
        );
        expect(focused.transitionDuration, `${runtime}/focus-transition-duration`).toBe('0.15s');
        expect(await readFocusPaint(), `${runtime}/focus-stable-endpoint`).toEqual(focused);

        await editableSurface.blur();
        await page.waitForTimeout(220);
        expect(await readFocusPaint(), `${runtime}/blur-restored-endpoint`).toEqual(unfocused);

        expect(facts.button.height, `${runtime}/button-height`).toBe('32px');
        expect(facts.button.paddingLeft, `${runtime}/button-padding-left`).toBe('10px');
        expect(facts.button.paddingRight, `${runtime}/button-padding-right`).toBe('10px');
        expect(facts.button.borderWidth, `${runtime}/button-border-width`).toBe('1px');
        expect(facts.button.borderStyle, `${runtime}/button-border-style`).toBe('solid');
        expect(facts.button.color, `${runtime}/button-foreground`).toBe(expectedButton.foreground);
        expect(facts.button.background, `${runtime}/button-background`).toBe(
          colorScheme === 'dark' ? expectedButton.inputBackground : expectedButton.background
        );
        expect(facts.button.borderColor, `${runtime}/button-border-color`).toBe(
          colorScheme === 'dark' ? expectedButton.inputBorder : expectedButton.border
        );
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
      await openStandaloneTheme(colorScheme);
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

    it(`round-trips Hover Card closed and open endpoints in ${colorScheme} mode`, async () => {
      // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-STANDALONE-FOUR-RUNTIMES
      await openStandaloneTheme(colorScheme);

      const readEndpoint = async (runtime: (typeof RUNTIMES)[number]) =>
        page.evaluate((runtimeId) => {
          const boundary = document.querySelector<HTMLElement>(
            `[data-demo-ref="hover-content-${runtimeId}"]`
          );
          const surface = boundary?.hasAttribute('data-pui-style')
            ? boundary
            : boundary?.querySelector<HTMLElement>('[data-pui-style]');
          if (!surface) return { present: false as const };
          const style = getComputedStyle(surface);
          return {
            present: true as const,
            opacity: style.opacity,
            borderColor: style.borderTopColor,
            background: style.backgroundColor,
            color: style.color,
          };
        }, runtime);

      const waitForOpenEndpoint = async (runtime: (typeof RUNTIMES)[number]) =>
        page.waitForFunction(
          (runtimeId) => {
            const boundary = document.querySelector<HTMLElement>(
              `[data-demo-ref="hover-content-${runtimeId}"]`
            );
            const surface = boundary?.hasAttribute('data-pui-style')
              ? boundary
              : boundary?.querySelector<HTMLElement>('[data-pui-style]');
            if (!surface || getComputedStyle(surface).opacity !== '1') return false;

            const enterAnimations = surface
              .getAnimations()
              .filter(
                (animation) =>
                  animation instanceof CSSAnimation && animation.animationName === 'pui-enter'
              );
            return (
              enterAnimations.length > 0 &&
              enterAnimations.every((animation) => animation.playState === 'finished')
            );
          },
          runtime,
          { timeout: 20_000 }
        );

      const expected = await readTokenPaint();
      for (const runtime of RUNTIMES) {
        const trigger = page.locator(`[data-demo-ref="hover-trigger-${runtime}"]`).first();
        await trigger.hover();
        await waitForOpenEndpoint(runtime);

        await page.mouse.move(2, 2);
        await page.waitForFunction(
          (runtimeId) => {
            const boundary = document.querySelector<HTMLElement>(
              `[data-demo-ref="hover-content-${runtimeId}"]`
            );
            const surface = boundary?.hasAttribute('data-pui-style')
              ? boundary
              : boundary?.querySelector<HTMLElement>('[data-pui-style]');
            return !surface || getComputedStyle(surface).opacity === '0';
          },
          runtime,
          { timeout: 20_000 }
        );
        const closed = await readEndpoint(runtime);
        expect(!closed.present || closed.opacity === '0', `${runtime}/closed-stable-endpoint`).toBe(
          true
        );

        await trigger.hover();
        await waitForOpenEndpoint(runtime);
        const reopened = await readEndpoint(runtime);
        await page.waitForTimeout(60);
        expect(await readEndpoint(runtime), `${runtime}/reopened-stable-sample`).toEqual(reopened);
        expect(reopened, `${runtime}/reopened-stable-endpoint`).toEqual({
          present: true,
          opacity: '1',
          borderColor: expected.border,
          background: expected.popoverBackground,
          color: expected.popoverForeground,
        });
      }
    }, 120_000);
  }
});
