import { describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';

describe('Web style compiler canonical typography scale', () => {
  it('lowers the new heading scale only onto token-owned surfaces, with leading overrides last', () => {
    const css = renderProtoStyleTokenCss([
      'text-2xl',
      'text-3xl',
      'text-4xl',
      'text-5xl',
      'leading-tight',
      'leading-snug',
      'leading-normal',
    ]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    for (const [token, size, line] of [
      ['text-2xl', '1.5rem', '2rem'],
      ['text-3xl', '1.875rem', '2.25rem'],
      ['text-4xl', '2.25rem', '2.5rem'],
      ['text-5xl', '3rem', '1'],
    ])
      expect(css).toContain(
        `:where([data-pui-style~="${token}"]) {\n    font-size: ${size};\n    line-height: ${line};`
      );
    for (const [token, line] of [
      ['leading-tight', '1.25'],
      ['leading-snug', '1.375'],
      ['leading-normal', '1.5'],
    ]) {
      expect(css).toContain(`:where([data-pui-style~="${token}"]) {\n    line-height: ${line};`);
      expect(css.indexOf(`data-pui-style~="${token}"`)).toBeGreaterThan(
        css.indexOf('data-pui-style~="text-5xl"')
      );
    }
    expect(css).not.toMatch(/(?:^|\n)\s*(?:body|h1|h2|p)\s*\{/);
  });
});
