import { describe, expect, it } from 'vitest';

import {
  PROTO_SHADOW_STYLE_ARTIFACT_KIND,
  PROTO_SHADOW_STYLE_ARTIFACT_VERSION,
  PROTO_SHADOW_STYLE_ENVIRONMENT,
  renderPrefixedThemeCss,
  renderProtoShadowStyleArtifact,
  renderProtoShadowStyleTokenCss,
  renderProtoStyleEntryCss,
  renderProtoStyleTokenCss,
} from '../src/services/proto-style-css';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';

describe('proto style css renderer', () => {
  it('keeps authored spaces and newlines without hanging preserved spaces into padding', () => {
    const css = renderProtoStyleTokenCss(['whitespace-break-spaces']);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('white-space: break-spaces;');
  });
  it('lowers intrinsic action wrapping and bounded grid tracks without media variants', () => {
    const css = renderProtoStyleTokenCss([
      'flex-wrap-reverse',
      'grid-cols-1',
      'min-w-0',
      'h-auto',
      'min-h-8',
      'max-w-full',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('flex-wrap: wrap-reverse;');
    expect(css).toContain('grid-template-columns: repeat(1, minmax(0, 1fr));');
    expect(css).toContain('min-width: 0px;');
  });
  it('lowers logical available-region bounds without dropping max-width arithmetic', () => {
    const css = renderProtoStyleTokenCss([
      'left-[var(--proto-ui-available-region-center-x,50%)]',
      'max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
      'max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)]',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('left: var(--proto-ui-available-region-center-x,50%);');
    expect(css).toContain(
      'max-width: min(32rem,calc(var(--proto-ui-available-region-width,100%) - 2rem));'
    );
    expect(css).toContain('max-height: calc(var(--proto-ui-available-region-height,100%) - 2rem);');
  });
  it.each(['auto', 'text', 'none'])(
    'diagnoses selection:select-%s instead of emitting inert highlight CSS',
    (value) => {
      const token = `selection:select-${value}`;
      const css = renderProtoStyleTokenCss([token, `dark:${token}`]);
      expect(css).toContain('Unsupported Proto UI style tokens');
      expect(css).toContain(`* - ${token}`);
      expect(css).toContain(`* - dark:${token}`);
      expect(css).not.toContain('::selection');
      expect(css).not.toContain('user-select:');
    }
  );
  it('closes explicit content-selection affordances only on their authored subjects', () => {
    // T-CONTENT-SELECTION-AFFORDANCE-0001-CASE-CSS
    const css = renderProtoStyleTokenCss(['select-auto', 'select-text', 'select-none']);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const value of ['auto', 'text', 'none']) {
      expect(css).toContain(`:where([data-pui-style~="select-${value}"])`);
      expect(css).toContain(`-webkit-user-select: ${value};`);
      expect(css).toContain(`user-select: ${value};`);
    }
    expect(css).not.toMatch(/(?:html|body|\*)\s*\{[^}]*user-select/s);
  });

  it('lowers both Scroll Area track inset dimensions to valid spaced CSS math', () => {
    const css = renderProtoStyleTokenCss([
      'data-[orientation=vertical]:h-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))]',
      'data-[orientation=horizontal]:w-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))]',
    ]);
    expect(css).toContain('height: calc(100% - var(--proto-ui-scroll-track-end-inset,0px));');
    expect(css).toContain('width: calc(100% - var(--proto-ui-scroll-track-end-inset,0px));');
  });
  it('keeps motion hit envelopes on the same host and behind lowered state predicates', () => {
    const css = renderProtoStyleTokenCss([
      'hit-envelope-translate-1',
      'data-[hovered]:hit-envelope-translate-1',
      'data-[pressed]:hit-envelope-translate-1',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain(`:where([data-pui-style~="hit-envelope-translate-1"])::before`);
    expect(css).toContain(
      `:where([data-pui-style~="data-[hovered]:hit-envelope-translate-1"])[data-hovered]::before`
    );
    expect(css).toContain(
      `:where([data-pui-style~="data-[pressed]:hit-envelope-translate-1"])[data-pressed]::before`
    );
    expect(css).toContain('top: calc(-0.25rem - 2px);');
    expect(css).toContain('left: calc(-0.25rem - 2px);');
    expect(css).toContain('right: -2px;');
    expect(css).toContain('bottom: -2px;');
  });
  it('gives Proto UI styled elements a scoped border-box baseline without a global reset', () => {
    // T-WEB-STYLE-BASELINE-0001-CASE-PROTO-LAYER-PLACEMENT
    const css = renderProtoStyleTokenCss(['h-6', 'w-11', 'border']);
    const layerAt = css.indexOf('@layer proto-ui {');
    const baselineAt = css.indexOf(
      `  [data-pui-style],\n  [data-pui-style]::before,\n  [data-pui-style]::after {`
    );
    const firstTokenAt = css.indexOf(':where([data-pui-style~=');

    expect(baselineAt).toBeGreaterThan(layerAt);
    expect(baselineAt).toBeLessThan(firstTokenAt);
    expect(css).toContain('box-sizing: border-box;');
    expect(css).not.toMatch(/(^|\n)\*\s*,/);
    expect(css).not.toMatch(/(^|\n)::before\s*,/);
    expect(css).not.toMatch(/(^|\n)::after\s*\{/);
  });

  it('places generated theme defaults below the Proto UI layer and consumer layers', () => {
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-GENERATED-LAYER-SLOT
    const css = renderProtoStyleEntryCss({
      themeImport: './shadcn-theme.css',
      tokensImport: './proto-ui-tokens.generated.css',
    });
    const preludeAt = css.indexOf('@layer theme, proto-ui;');
    const themeImportAt = css.indexOf("@import './shadcn-theme.css' layer(theme);");
    const tokensImportAt = css.indexOf("@import './proto-ui-tokens.generated.css';");
    const declaredLayerSlots = [...css.matchAll(/@layer\s+([^;{]+)\s*;/g)].map((match) =>
      match[1].trim()
    );

    expect(preludeAt).toBeGreaterThan(-1);
    expect(preludeAt).toBeLessThan(themeImportAt);
    expect(preludeAt).toBeLessThan(tokensImportAt);
    expect(declaredLayerSlots).toEqual(['theme, proto-ui']);
    expect(css).not.toContain("@import './shadcn-theme.css';");
  });

  it('normalizes only styled native controls at zero specificity before token rules', () => {
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-GENERATED-NORMALIZATION
    // T-PROTOTYPE-STYLE-CLOSURE-0001-CASE-NORMALIZATION-SCOPE
    const css = renderProtoStyleTokenCss([
      'border',
      'border-input',
      'bg-background',
      'p-2',
      'text-foreground',
    ]);
    const selector =
      ':where(button[data-pui-style], input[data-pui-style], select[data-pui-style], textarea[data-pui-style])';
    const layerAt = css.indexOf('@layer proto-ui {');
    const normalizationAt = css.indexOf(selector);
    const firstTokenAt = css.indexOf(':where([data-pui-style~=');

    expect(normalizationAt).toBeGreaterThan(layerAt);
    expect(normalizationAt).toBeLessThan(firstTokenAt);

    const normalization = css.slice(normalizationAt, firstTokenAt);
    for (const declaration of [
      'font: inherit;',
      'font-feature-settings: inherit;',
      'font-variation-settings: inherit;',
      'letter-spacing: inherit;',
      'color: inherit;',
      'margin: 0;',
      'padding: 0;',
      'border: 0;',
      'background: transparent;',
      'opacity: 1;',
    ]) {
      expect(normalization).toContain(declaration);
    }

    expect(css).not.toMatch(/(^|\n)\s*(button|input|select|textarea)\s*(,|\{)/);
    expect(css).not.toMatch(/(^|\n)\s*\*\s*(,|\{)/);
    expect(css).not.toContain('!important');
  });

  it('renders space-between layout utilities used by compound controls', () => {
    const css = renderProtoStyleTokenCss(['flex', 'justify-between']);

    expect(css).toContain('display: flex;');
    expect(css).toContain('justify-content: space-between;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the vertical resize utility used by Brutalist Textarea', () => {
    const css = renderProtoStyleTokenCss(['resize-y']);

    expect(css).toContain('resize: vertical;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders whitespace-preserving wrapping utilities for private compositions', () => {
    const css = renderProtoStyleTokenCss(['whitespace-pre-wrap', 'wrap-anywhere']);

    expect(css).toContain('white-space: pre-wrap;');
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders intrinsic sizing and surface utilities used by Shadcn Tabs v4', () => {
    const css = renderProtoStyleTokenCss([
      'w-fit',
      'h-fit',
      'flex-1',
      'shadow-sm',
      'outline-1',
      'outline-ring',
    ]);

    expect(css).toContain('width: fit-content;');
    expect(css).toContain('height: fit-content;');
    expect(css).toContain('flex: 1 1 0%;');
    expect(css).toContain('--pui-shadow: 0 1px 3px 0');
    expect(css).toContain('outline-style: solid;');
    expect(css).toContain('outline-width: 1px;');
    expect(css).toContain('outline-color: var(--pui-ring);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders solid black surfaces and treats brutalist group markers as no-ops', () => {
    const css = renderProtoStyleTokenCss([
      'bg-black',
      'group/brutalist-button',
      'group/brutalist-toggle',
    ]);

    expect(css).toContain('[data-pui-style~="bg-black"]');
    expect(css).toContain('background-color: #000;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the composed inset and outer hard shadows used by active Brutalist Toggle', () => {
    const css = renderProtoStyleTokenCss([
      'shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]',
      'shadow-[inset_0_0_0_2px_#000]',
    ]);

    expect(css).toContain('--pui-shadow: inset 0 0 0 2px #000, 3px 3px 0 0 #000;');
    expect(css).toContain('--pui-shadow: inset 0 0 0 2px #000;');
    expect(css).toContain(
      'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
    );
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the exact box and glyph geometry used by Shadcn Checkbox', () => {
    const css = renderProtoStyleTokenCss(['rounded-[4px]', 'size-4', 'size-3.5']);

    // The theme-derived `rounded-sm` is 6px and `size-3` is 12px. On a 16px box
    // both are visible, so the projection needs these two exact values.
    expect(css).toContain('border-radius: 4px;');
    expect(css).toContain('width: 0.875rem;');
    expect(css).toContain('height: 0.875rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('closes and renders the surface-paired frame tokens used by Brutalist Checkbox', () => {
    expect(BRUTALIST_STYLE_TOKENS).toContain('border-main-foreground');
    expect(BRUTALIST_STYLE_TOKENS).toContain(
      'data-[checked]:not-[data-indeterminate]:border-background'
    );

    const css = renderProtoStyleTokenCss([
      'text-current',
      'opacity-0',
      'opacity-100',
      'border-main-foreground',
      'border-background',
    ]);

    expect(css).toContain('color: currentColor;');
    expect(css).toContain('opacity: 0;');
    expect(css).toContain('opacity: 1;');
    expect(css).toContain('border-color: var(--pui-main-foreground);');
    expect(css).toContain('border-color: var(--pui-background);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('resets composed custom properties inside the layer, below every token rule', () => {
    const css = renderProtoStyleTokenCss(['ring-2', 'shadow-[3px_3px_0_0_#000]', 'translate-x-0']);

    const layerAt = css.indexOf('@layer proto-ui {');
    const resetAt = css.indexOf(':where([data-pui-style]) {');
    const firstTokenAt = css.indexOf(':where([data-pui-style~=');

    // Inside the layer, because the unlayered baseline would outrank every
    // token rule and no ring could paint at all.
    expect(layerAt).toBeGreaterThanOrEqual(0);
    expect(resetAt).toBeGreaterThan(layerAt);
    // First in the layer, because a token rule is `:where()` too and only
    // source order puts it on top.
    expect(resetAt).toBeLessThan(firstTokenAt);

    // `initial` restores the guaranteed-invalid value, so the fallback declared
    // next to each `var()` stays the one place the default is written.
    for (const property of [
      '--pui-ring-offset-shadow',
      '--pui-ring-shadow',
      '--pui-shadow',
      '--pui-translate-x',
      '--pui-scale-x',
    ]) {
      expect(css.slice(resetAt, firstTokenAt)).toContain(`${property}: initial;`);
    }
  });

  it('renders directional separator borders in the theme foreground', () => {
    const css = renderProtoStyleTokenCss(['border-b-2', 'border-t-2', 'border-foreground']);

    expect(css).toContain('border-bottom-width: 2px;');
    expect(css).toContain('border-top-width: 2px;');
    expect(css).toContain('border-color: var(--pui-foreground);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders internal negative data selector variants', () => {
    const css = renderProtoStyleTokenCss(['data-[hovered]:not-[data-active]:bg-muted']);

    expect(css).toContain(
      ':where([data-pui-style~="data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])'
    );
    expect(css).toContain('background-color: var(--pui-muted);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the allowlisted static text-selection pseudo-element variants', () => {
    const css = renderProtoStyleTokenCss([
      'selection:bg-primary',
      'selection:text-primary-foreground',
    ]);

    expect(css).toContain(
      ':where([data-pui-style~="selection:bg-primary"])::selection {\n    background-color: var(--pui-primary);'
    );
    expect(css).toContain(
      ':where([data-pui-style~="selection:text-primary-foreground"])::selection {\n    color: var(--pui-primary-foreground);'
    );
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('lets dark tokens follow the system preference when the host has no explicit theme', () => {
    const css = renderProtoStyleTokenCss(['dark:bg-input/30']);

    expect(css).toContain(':where(.dark)');
    expect(css).toContain(":where([data-theme='dark'])");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(
      ":where(:root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light']))"
    );
  });

  it('uses the host-color-scheme-v1 marker as the only Shadow dark environment selector', () => {
    const css = renderProtoShadowStyleTokenCss(['dark:bg-input/30']);

    expect(css).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:bg-input/30"])`
    );
    expect(css).toContain(
      'background-color: color-mix(in oklab, var(--pui-input) 30%, transparent);'
    );
    expect(css).not.toContain(':where(.dark)');
    expect(css).not.toContain('[data-theme=');
    expect(css).not.toContain(':root');
    expect(css).not.toContain('@media (prefers-color-scheme: dark)');
  });

  it('keeps ordinary Shadow dark context at zero specificity against state rules', () => {
    // D-WEB-COMPONENT-SHADOW-STYLE-0001 B/C: environment substitution must
    // not give dark:p-2 precedence over the document's data-[open]:p-4.
    const tokens = ['dark:p-2', 'data-[open]:p-4', 'dark:data-[open]:p-8'];
    const shadow = renderProtoShadowStyleTokenCss(tokens);
    expect(shadow).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:p-2"])`
    );
    expect(shadow).toContain(`:where([data-pui-style~="data-[open]:p-4"])[data-open]`);
    expect(shadow).toContain(
      `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="dark:data-[open]:p-8"])[data-open]`
    );
    expect(shadow).not.toContain(`:host([data-pui-color-scheme='dark']) :where`);
    for (const css of [shadow, renderProtoStyleTokenCss(tokens)]) {
      expect(css).toContain('padding: 0.5rem;');
      expect(css).toContain('padding: 1rem;');
      expect(css).toContain('padding: 2rem;');
    }
  });

  it('keeps non-environment Shadow output identical to document output', () => {
    const tokens = [
      'animate-in',
      'duration-200',
      'fade-in-0',
      'ring-2',
      'translate-x-0',
      'unsupported-shadow-token',
    ];

    expect(renderProtoShadowStyleTokenCss(tokens)).toBe(renderProtoStyleTokenCss(tokens));
  });

  it('preserves declarations, ordering, keyframes, baseline, and diagnostics around Shadow dark rules', () => {
    const css = renderProtoShadowStyleTokenCss([
      'animate-in',
      'dark:bg-input/30',
      'duration-200',
      'fade-in-0',
      'unsupported-shadow-token',
    ]);

    expect(css).toContain('[data-pui-style]::before');
    expect(css).toContain(':where([data-pui-style]) {');
    expect(css).toContain('@keyframes pui-enter');
    expect(css).toContain('--pui-enter-opacity: 0');
    expect(css).toContain('transition-duration: 200ms;');
    expect(css).toContain('Unsupported Proto UI style tokens:');
    expect(css).toContain('* - unsupported-shadow-token');
    expect(css.indexOf('[data-pui-style~="animate-in"]')).toBeLessThan(
      css.indexOf('[data-pui-style~="duration-200"]')
    );
  });

  it('builds a frozen versioned Shadow style artifact without exporting theme declarations', () => {
    const artifact = renderProtoShadowStyleArtifact(['dark:bg-input/30']);

    expect(artifact).toEqual({
      kind: PROTO_SHADOW_STYLE_ARTIFACT_KIND,
      version: PROTO_SHADOW_STYLE_ARTIFACT_VERSION,
      cssText: renderProtoShadowStyleTokenCss(['dark:bg-input/30']),
      environment: PROTO_SHADOW_STYLE_ENVIRONMENT,
    });
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(artifact.cssText).not.toContain('--pui-background:');
  });

  it('adds a system dark fallback to generated theme variables', () => {
    const css = renderPrefixedThemeCss(`:root {
  --background: white;
}

:root.dark,
:root[data-theme='dark'] {
  --background: black;
}`);

    expect(css).toContain('--pui-background: white;');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(
      ":root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light']) {"
    );
    expect(css).toContain('--pui-background: black;');
  });

  it('renders composable enter and exit animation utilities', () => {
    const css = renderProtoStyleTokenCss([
      'animate-in',
      'fade-in-0',
      'zoom-in-95',
      'animate-out',
      'fade-out-0',
      'zoom-out-95',
      'transition-none',
      'duration-200',
    ]);

    expect(css).toContain('@keyframes pui-enter');
    expect(css).toContain('@keyframes pui-exit');
    expect(css).toContain('animation-name: pui-enter;');
    expect(css).toContain('animation-name: pui-exit;');
    expect(css).toContain('--pui-enter-opacity: 0;');
    expect(css).toContain('--pui-exit-opacity: 0;');
    expect(css).toContain('--pui-enter-scale: 0.95;');
    expect(css).toContain('--pui-exit-scale: 0.95;');
    expect(css).toContain(
      'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-enter-scale, 1));'
    );
    expect(css).toContain(
      'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-exit-scale, 1));'
    );
    expect(css).not.toContain('scale: var(--pui-enter-scale');
    expect(css).toContain('--pui-animation-duration: 200ms;');
    expect(css).toContain('transition-property: none;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
  it('emits explicit duration and ease overrides after transition utilities so they win the cascade', () => {
    const css = renderProtoStyleTokenCss([
      'duration-200',
      'ease-in-out',
      'transition-all',
      'transition-colors',
    ]);

    const transitionAll = css.indexOf('[data-pui-style~="transition-all"]');
    const transitionColors = css.indexOf('[data-pui-style~="transition-colors"]');
    const duration = css.indexOf('[data-pui-style~="duration-200"]');
    const ease = css.indexOf('[data-pui-style~="ease-in-out"]');

    expect(transitionAll).toBeGreaterThan(-1);
    expect(duration).toBeGreaterThan(transitionAll);
    expect(duration).toBeGreaterThan(transitionColors);
    expect(ease).toBeGreaterThan(transitionAll);
    expect(ease).toBeGreaterThan(transitionColors);
    expect(css).toContain('transition-duration: 150ms;');
    expect(css).toContain('transition-duration: 200ms;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
  it('emits explicit leading overrides after text-size utilities', () => {
    const css = renderProtoStyleTokenCss(['leading-6', 'text-sm']);

    const textSize = css.indexOf('[data-pui-style~="text-sm"]');
    const leading = css.indexOf('[data-pui-style~="leading-6"]');

    expect(textSize).toBeGreaterThan(-1);
    expect(leading).toBeGreaterThan(textSize);
    expect(css).toContain('line-height: 1.25rem;');
    expect(css).toContain('line-height: 1.5rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('emits explicit leading overrides after text-size utilities so they win the cascade', () => {
    const css = renderProtoStyleTokenCss(['leading-6', 'text-sm']);
    const textSize = css.indexOf('[data-pui-style~="text-sm"]');
    const leading = css.indexOf('[data-pui-style~="leading-6"]');

    expect(textSize).toBeGreaterThan(-1);
    expect(leading).toBeGreaterThan(textSize);
  });

  it('renders state-driven spacing translations used by the Switch thumb', () => {
    const css = renderProtoStyleTokenCss([
      'translate-x-0',
      'data-[checked]:translate-x-[calc(100%_-_2px)]',
      'ring-offset-0',
    ]);

    expect(css).toContain('--pui-translate-x: 0px;');
    expect(css).toContain(
      ':where([data-pui-style~="data-[checked]:translate-x-[calc(100%_-_2px)]"])[data-checked]'
    );
    expect(css).toContain('--pui-translate-x: calc(100% - 2px);');
    expect(css).toContain('--pui-ring-offset-width: 0px;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders Hover Card positioning, popover, shadow, and directional motion utilities', () => {
    const css = renderProtoStyleTokenCss([
      'bg-popover',
      'text-popover-foreground',
      'w-64',
      'shadow-md',
      'bottom-full',
      'right-full',
      'mb-1',
      'translate-y-0',
      'slide-in-from-left-2',
      'slide-in-from-top-2',
    ]);

    expect(css).toContain('background-color: var(--pui-popover);');
    expect(css).toContain('color: var(--pui-popover-foreground);');
    expect(css).toContain('width: 16rem;');
    expect(css).toContain('bottom: 100%;');
    expect(css).toContain('right: 100%;');
    expect(css).toContain('margin-bottom: 0.25rem;');
    expect(css).toContain('--pui-shadow: 0 4px 6px -1px');
    expect(css).toContain('--pui-translate-x: -0.5rem;');
    expect(css).toContain('--pui-translate-y: -0.5rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
  it('renders the Bootstrap 2.3.2 field inset and alignment without losing current shared tokens', () => {
    const css = renderProtoStyleTokenCss([
      'justify-start',
      'font-sans',
      'rounded-base',
      'shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]',
    ]);
    expect(css).toContain('justify-content: flex-start;');
    expect(css).toContain(
      'font-family: var(--pui-font-sans, ui-sans-serif, system-ui, sans-serif);'
    );
    expect(css).toContain('border-radius: var(--pui-radius);');
    expect(css).toContain('--pui-shadow: inset 0 1px 1px rgb(0 0 0 / 0.075);');
    expect(css).toContain('var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000)');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
});

describe('normalized continuous layout projection', () => {
  it('lowers static exposed-state flex basis and vertical slider positions', () => {
    const tokens = [
      'basis-2',
      'basis-[calc(var(--pui-size)*1%)]',
      'bottom-[calc(var(--pui-percentage)*1%)]',
    ];
    for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('flex-basis: 0.5rem;');
      expect(css).toContain('flex-basis: calc(var(--pui-size)*1%);');
      expect(css).toContain('bottom: calc(var(--pui-percentage)*1%);');
    }
  });
});

describe('Finf authored layout utility closure', () => {
  it('realizes the collected component vocabulary in document and Shadow CSS', () => {
    const tokens = [
      'border-dashed',
      'cursor-move',
      'grid-cols-7',
      'grow',
      'grow-0',
      'h-48',
      'inline-grid',
      'items-stretch',
      'max-w-md',
      'min-h-24',
      'min-w-40',
      'mx-0',
      'mx-1',
      'my-1',
      'rounded',
      'self-stretch',
      'shadow-[2px_2px_0_0_var(--pui-border)]',
      'shrink',
      'tabular-nums',
      'text-center',
      'w-1/3',
      'w-96',
      'w-auto',
    ];
    for (const css of [renderProtoStyleTokenCss(tokens), renderProtoShadowStyleTokenCss(tokens)]) {
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
      expect(css).toContain('flex-grow: 0;');
      expect(css).toContain('flex-shrink: 1;');
      expect(css).toContain('margin-inline: 0.25rem;');
      expect(css).toContain('margin-block: 0.25rem;');
      expect(css).toContain('--pui-shadow: 2px 2px 0 0 var(--pui-border);');
      expect(css).toContain('font-variant-numeric: tabular-nums;');
      expect(css).toContain('width: 24rem;');
    }
  });
});
