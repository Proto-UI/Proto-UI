import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectFamilyStyleClosure } from '../../../../scripts/styles/family-style-closure';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';
import { unwrapGeneratedTokenLayer } from '../../../../scripts/release/consumer-smoke-css.mjs';
import button from '../src/button';

// T-SHADCN-BUTTON-0001-CASE-GHOST-CONSUMER:
// Collect the actual source; never seed the generator with an expected new token.
// Both dark ghost Rules also gate on private style selection, so source
// collection preserves their bare runtime tokens rather than Web variants.
const ghostDarkTokens = ['bg-muted/50', 'bg-accent/50'];
const darkDeclaration = 'background-color: color-mix(in oklab, var(--pui-muted) 50%, transparent);';

it('carries real ghost Rules through the official preset and all existing physical CSS targets', async () => {
  const sourceTokens = (await collectProtoStyleTokens(
    path.resolve('packages/prototypes/shadcn/src/button')
  )) as string[];
  expect(sourceTokens).toContain('text-accent-foreground');
  for (const token of ghostDarkTokens) expect(sourceTokens).toContain(token);
  const closure = await collectFamilyStyleClosure(
    path.resolve('packages/prototypes/shadcn/src'),
    path.resolve('packages/prototypes/base/src')
  );
  expect(SHADCN_STYLE_TOKENS).toEqual(closure.tokens);
  for (const token of ghostDarkTokens) expect(SHADCN_STYLE_TOKENS).toContain(token);
  for (const css of [
    renderProtoStyleTokenCss(sourceTokens),
    renderProtoShadowStyleTokenCss(sourceTokens),
    renderProtoShadowSplitStyleArtifact(sourceTokens).cssText,
  ]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const token of ghostDarkTokens) expect(css).toContain(`[data-pui-style~="${token}"]`);
    expect(css).toContain(darkDeclaration);
    expect(css).toContain(
      'background-color: color-mix(in oklab, var(--pui-accent) 50%, transparent);'
    );
    expect(css).toContain('color: var(--pui-accent-foreground);');
    expect(css).toContain('color: var(--pui-foreground);');
    const withoutGhostDark = sourceTokens.filter((token) => !token.includes('bg-muted/50'));
    expect(renderProtoStyleTokenCss(withoutGhostDark)).not.toContain(darkDeclaration);
  }
  // This deliberately checks the complete family+inherited closure, rather
  // than narrowing the scan to Button to fit the unit-test default timeout.
}, 180_000);

if (!customElements.get(button.name)) AdaptToWebComponent(button);
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};

it('matches generated hover declarations against the real Button host during theme and prop changes', async () => {
  const previousClass = document.documentElement.className;
  const style = document.createElement('style');
  // Existing helper removes only the generated outer @layer for HappyDOM.
  // This is selector/declaration evidence, not native cascade-layer or pixel evidence.
  style.textContent = unwrapGeneratedTokenLayer(renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS));
  const element = document.createElement(button.name);
  element.className = 'consumer-owned';
  element.textContent = 'Ghost';
  // HappyDOM 15 drops color-mix declarations from CSSOM. Match the exact emitted
  // selectors against the real host and retain their unmodified source values.
  // Explicit light/dark markers exclude the emitted system-fallback selectors.
  const matched = (property: 'background-color' | 'color') =>
    [...style.textContent!.matchAll(/^[ \t]*(:where[^{}]+)\{([^{}]+)\}/gm)]
      .filter(([, , body]) => new RegExp(`(?:^|;)\\s*${property}:`).test(body))
      // HappyDOM 15 misparses commas inside quoted attribute values in :where.
      // Exclude selectors whose required token is absent before asking it to
      // match. This does not alter declarations or discard any possible match.
      .filter(([, selector]) => {
        const required = /\[data-pui-style~="([^"]+)"\]/.exec(selector)?.[1];
        return (
          !required ||
          (element.getAttribute('data-pui-style') ?? '').split(/\s+/).includes(required)
        );
      })
      .filter(([, selector]) => element.matches(selector.trim()))
      .flatMap(([, , body]) =>
        [...body.matchAll(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+);`, 'g'))].map((match) =>
          match[1].trim()
        )
      );
  try {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.head.append(style);
    setElementProps(element, { variant: 'ghost' });
    document.body.append(element);
    await flush();
    expect(element.className).toBe('consumer-owned');
    expect(element.getAttribute('data-hovered')).toBeNull();
    element.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(element.hasAttribute('data-hovered')).toBe(true);
    expect(matched('background-color')).toContain('var(--pui-muted)');
    expect(matched('color')).toContain('var(--pui-foreground)');
    expect(matched('background-color')).not.toContain('var(--pui-accent)');
    expect(matched('background-color')).not.toContain(
      'color-mix(in oklab, var(--pui-muted) 50%, transparent)'
    );
    document.documentElement.classList.replace('light', 'dark');
    // Await the actual environment observer notification, not a fixed sleep.
    await vi.waitFor(() => expect(element.getAttribute('data-pui-style')).toContain('bg-muted/50'));
    expect(matched('background-color')).toContain(
      'color-mix(in oklab, var(--pui-muted) 50%, transparent)'
    );
    document.documentElement.classList.replace('dark', 'light');
    await vi.waitFor(() =>
      expect(element.getAttribute('data-pui-style')).not.toContain('bg-muted/50')
    );
    expect(matched('background-color')).not.toContain(
      'color-mix(in oklab, var(--pui-muted) 50%, transparent)'
    );
    setElementProps(element, { variant: 'ghost', disabled: true });
    await flush();
    expect(element.hasAttribute('data-hovered')).toBe(false);
    expect(matched('background-color')).not.toContain('var(--pui-muted)');
    expect(element.getAttribute('aria-disabled')).toBe('true');
    setElementProps(element, { variant: 'default', disabled: false });
    await flush();
    element.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(matched('background-color')).toContain(
      'color-mix(in oklab, var(--pui-primary) 80%, transparent)'
    );
    expect(matched('background-color')).not.toContain(
      'color-mix(in oklab, var(--pui-primary) 90%, transparent)'
    );
    expect(matched('color')).not.toContain('var(--pui-foreground)');
    element.dispatchEvent(new PointerEvent('pointerleave'));
    await flush();
    expect(element.hasAttribute('data-hovered')).toBe(false);
  } finally {
    element.remove();
    style.remove();
    document.documentElement.className = previousClass;
    await flush();
  }
});
