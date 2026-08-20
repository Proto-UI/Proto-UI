/**
 * DOM/CSS live-theme evidence for T-BRUTALIST-BUTTON-0001-CASE-8
 * (P-BRUTALIST-BUTTON-LIVE-THEME, P-BRUTALIST-BUTTON-PAIR-INVARIANT).
 *
 * Mounts a Brutalist Button as a Web Component inside a theme-scoped wrapper,
 * injects the Proto UI token CSS produced from the official prototype tokens,
 * and proves that the surface fill follows runtime CSS-variable changes on
 * the host scope without any pointer events — for both enabled and disabled
 * controls. This verifies the live-theme mechanism (surface fill resolves
 * through `var(--pui-secondary-background)` / `var(--pui-foreground)` which
 * a host theme can swap at runtime).
 *
 * Note: happy-dom (the workspace test environment) does not implement CSS
 * `@layer` and has limited `:root` cascade support, so this fixture scopes
 * theme variables to a wrapper element rather than `:root` and strips the
 * `@layer` wrapper from the token CSS. The runtime contract under test
 * (token -> CSS variable -> host-theme-driven repaint) is unchanged.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css.js';
import { BRUTALIST_STYLE_TOKENS } from '../../../cli/src/generated/brutalist-style-tokens.js';
import { BRUTALIST_THEME_CSS } from '../../../cli/src/generated/brutalist-theme.js';
import { brutalistButton } from '../src/button';

// Strip `@layer proto-ui { ... }` wrapper (happy-dom does not implement @layer).
const TOKEN_CSS = renderProtoStyleTokenCss(BRUTALIST_STYLE_TOKENS).replace(
  /@layer proto-ui \{\n([\s\S]*)\n\}\n$/,
  '$1'
);

// Extract Light/Dark variable maps from the theme CSS for direct host-scope use.
const THEME_CSS = renderPrefixedThemeCss(BRUTALIST_THEME_CSS);

function extractVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--pui-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars[`--pui-${name}`] = value.trim();
  }
  return vars;
}

const lightBlock = THEME_CSS.match(/:root \{([\s\S]*?)\}/)?.[1] ?? '';
const darkBlock = THEME_CSS.match(/:root\.dark,[\s\S]*?\{([\s\S]*?)\}/)?.[1] ?? '';
const LIGHT_VARS = extractVars(lightBlock);
const DARK_VARS = extractVars(darkBlock);

function cssVar(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function injectTokenStyles(): HTMLStyleElement {
  const el = document.createElement('style');
  el.setAttribute('data-brutalist-live-theme-test', '');
  el.textContent = TOKEN_CSS;
  document.head.appendChild(el);
  return el;
}

function applyTheme(wrapper: HTMLElement, vars: Record<string, string>): void {
  for (const [name, value] of Object.entries(vars)) {
    wrapper.style.setProperty(name, value);
  }
}

function mount(variant: string, disabled: boolean): { wrapper: HTMLElement; el: HTMLElement } {
  AdaptToWebComponent(brutalistButton, { registerAs: 'wc-brutalist-live-button' });
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-brutalist-theme-scope', '');
  applyTheme(wrapper, LIGHT_VARS);
  const el = document.createElement('wc-brutalist-live-button') as HTMLElement;
  setElementProps(el, { variant, disabled });
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  return { wrapper, el };
}

describe('prototypes/brutalist: button live-theme DOM', () => {
  afterEach(() => {
    document.querySelectorAll('[data-brutalist-live-theme-test]').forEach((n) => n.remove());
    document.querySelectorAll('[data-brutalist-theme-scope]').forEach((n) => n.remove());
  });

  // T-BRUTALIST-BUTTON-0001-CASE-8 / live theme
  it('repaints surface fills Light -> Dark -> Light without pointer events', async () => {
    injectTokenStyles();
    const { wrapper, el } = mount('surface', false);
    await Promise.resolve();
    await Promise.resolve();

    // Light: secondary-background = #ffffff, foreground = #171717.
    expect(cssVar(el, 'background-color')).toBe('#ffffff');
    expect(cssVar(el, 'color')).toBe('#171717');

    // Flip host scope to Dark — no pointer interaction involved.
    applyTheme(wrapper, DARK_VARS);
    await Promise.resolve();
    await Promise.resolve();
    expect(cssVar(el, 'background-color')).toBe('#262626');
    expect(cssVar(el, 'color')).toBe('#f5f5f5');

    // Flip back to Light, still without pointer events.
    applyTheme(wrapper, LIGHT_VARS);
    await Promise.resolve();
    await Promise.resolve();
    expect(cssVar(el, 'background-color')).toBe('#ffffff');
    expect(cssVar(el, 'color')).toBe('#171717');
  });

  it('keeps accent foreground ink in both themes (solid/main) while mounted', async () => {
    injectTokenStyles();
    const { wrapper, el } = mount('solid', false);
    setElementProps(el, { variant: 'solid', color: 'main' });
    await Promise.resolve();
    await Promise.resolve();

    // Accent pair is theme-invariant: canary (#fef08a) with black text.
    expect(cssVar(el, 'background-color')).toBe('#fef08a');
    expect(cssVar(el, 'color')).toBe('#000000');

    // Flipping the host scope does not change the accent pair.
    applyTheme(wrapper, DARK_VARS);
    await Promise.resolve();
    await Promise.resolve();
    expect(cssVar(el, 'background-color')).toBe('#fef08a');
    expect(cssVar(el, 'color')).toBe('#000000');
  });

  it('repaints disabled surface control under host theme flip', async () => {
    injectTokenStyles();
    const { wrapper, el } = mount('surface', true);
    await Promise.resolve();
    await Promise.resolve();

    // Disabled Light first.
    expect(cssVar(el, 'background-color')).toBe('#ffffff');

    // Disabled controls must repaint on host theme switch too.
    applyTheme(wrapper, DARK_VARS);
    await Promise.resolve();
    await Promise.resolve();
    expect(cssVar(el, 'background-color')).toBe('#262626');
  });
});
