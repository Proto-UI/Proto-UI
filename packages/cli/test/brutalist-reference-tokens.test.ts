import { describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';
import { BRUTALIST_THEME } from '../../prototypes/brutalist/src/theme';

describe('source-aligned Brutalist style closure', () => {
  it('materializes prototype-owned family, geometry, and reduced-motion transition tokens', () => {
    const css = renderProtoStyleTokenCss(BRUTALIST_STYLE_TOKENS);
    for (const token of [
      'font-sans',
      'font-heading',
      'font-medium',
      'font-bold',
      'rounded-base',
      'rounded-full',
      'transition-transform',
    ])
      expect(BRUTALIST_STYLE_TOKENS).toContain(token);
    expect(css).toContain(
      'font-family: var(--pui-font-sans, ui-sans-serif, system-ui, sans-serif);'
    );
    expect(css).toContain('border-radius: var(--pui-radius);');
    expect(css).toContain('transition-property: transform;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    const reduced = renderProtoStyleTokenCss(['transition-transform']).split(
      '@media (prefers-reduced-motion: reduce)'
    )[1];
    expect(reduced).toContain('[data-pui-style~="transition-transform"]');
    expect(reduced).toContain('transition-property: none;');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('transition-property: none;');
    for (const mode of [BRUTALIST_THEME.light, BRUTALIST_THEME.dark]) {
      expect(mode.radius).toBe('5px');
      expect(mode['font-sans']).toContain('"DM Sans"');
    }
  });
  it('retains explicit square/circle exceptions rather than a global radius override', () => {
    expect(BRUTALIST_STYLE_TOKENS).toContain('rounded-none');
    expect(BRUTALIST_STYLE_TOKENS).toContain('rounded-full');
    expect(BRUTALIST_STYLE_TOKENS).not.toContain('font-mono');
    expect(BRUTALIST_STYLE_TOKENS).not.toContain('uppercase');
    expect(BRUTALIST_THEME.light.main).toBe('#5294ff');
  });
});
