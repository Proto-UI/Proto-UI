// @vitest-environment node
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { renderShadowStyleDelivery } from '../src/services/shadow-style-delivery';

describe('Select existing preferred-width lowering', () => {
  for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
    it(`${family} actual tokens prefer readable popup width without a hard minimum`, async () => {
      const tokens = (
        await collectProtoStyleTokens(path.resolve(`packages/prototypes/${family}/src/select`))
      ).filter((token): token is string => typeof token === 'string');
      expect(tokens).toContain('w-[max(var(--proto-ui-anchor-width),12rem)]');
      expect(tokens).toContain('min-w-0');
      expect(tokens).toContain('max-w-[var(--proto-ui-available-width)]');
      expect(tokens).toContain('size-4');
      expect(tokens).toContain('gap-2');
      expect(tokens).toContain(family === 'liquid-glass' ? 'px-3' : 'px-5');
      const css = renderProtoStyleTokenCss(tokens);
      expect(css).toContain('width: max(var(--proto-ui-anchor-width),12rem)');
      expect(css).toContain('max-width: var(--proto-ui-available-width)');
      expect(css).not.toContain('min-width: 12rem');
      expect(() =>
        renderShadowStyleDelivery(tokens, 'narrowSelectProbe', {
          rootTokens: tokens,
          templateTokens: [],
        })
      ).not.toThrow();
    });
  }
  it('keeps unsupported fluid padding outside the production Shadow-split contract', () => {
    for (const token of [
      'px-[min(0.75rem,10%)]',
      'px-[min(0.5rem,calc(var(--proto-ui-available-width)*0.04))]',
    ]) {
      expect(() =>
        renderShadowStyleDelivery([token], 'unsupportedProbe', {
          rootTokens: [token],
          templateTokens: [],
        })
      ).toThrow(/verified length recipe/);
    }
  });
  // Declaration-budget checks only: not DOM geometry, font raster bounds or paint.
  it('records the 128px extra-stress limitation while allowing the original 320px/200% goal', () => {
    const font = 32,
      anchor = 78;
    const widthAt320 = Math.min(Math.max(anchor, 12 * font), 320 - 24);
    const widthAt128 = Math.min(Math.max(anchor, 12 * font), 128 - 24);
    // Liquid content 32 + item 48; Bootstrap content 0 + item 80.
    // Both then spend gap 16, indicator 32, borders 2.
    const decoration = 32 + 48 + 16 + 32 + 2;
    expect(anchor - decoration).toBeLessThan(0);
    expect(widthAt320 - decoration).toBeGreaterThan(0.875 * font);
    expect(widthAt128 - decoration).toBeLessThan(0); // Known extra-stress gap, not accepted.
  });
});
