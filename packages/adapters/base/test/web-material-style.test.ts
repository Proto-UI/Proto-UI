import { describe, expect, it } from 'vitest';
import { resolveMaterialStyle, resolvePaletteColor } from '../src/material/style';
const palette = { background: '#ffffff', foreground: '#171717', secondary: { role: 'background' } };
describe('governed material style provenance', () => {
  it('resolves owned opaque palette roles from the complete post-patch tokens', () => {
    const result = resolveMaterialStyle(
      [
        'rounded-lg',
        'bg-secondary',
        'text-sm',
        'text-center',
        'text-foreground',
        'selection:bg-primary',
      ],
      palette
    );
    expect(result.provenance).toBe('post-patch-complete');
    expect(result.fill).toEqual([1, 1, 1, 1]);
    expect(result.fillTokens).toEqual(['bg-secondary']);
  });
  it.each([
    ['bg-secondary/80', 'text-foreground'],
    ['bg-transparent', 'text-foreground'],
    ['bg-background'],
    ['text-foreground'],
    ['bg-background', 'bg-secondary', 'text-foreground'],
    ['bg-absent', 'text-foreground'],
    ['bg-background', 'text-white'],
  ])('does not invent opaque fallback from %j', (...tokens) => {
    expect(resolveMaterialStyle(tokens, palette).provenance).toBe('unknown');
  });
  it('rejects selector-dependent provenance and competing paint', () => {
    expect(
      resolveMaterialStyle(['bg-background', 'text-foreground', 'hover:bg-secondary'], palette)
        .provenance
    ).toBe('selector-dependent');
    expect(
      resolveMaterialStyle(['bg-background', 'text-foreground', 'backdrop-blur-xs'], palette)
        .competingPaint
    ).toEqual(['backdrop']);
  });
  it('rejects cyclic roles, alpha literals, and out-of-range components', () => {
    expect(resolvePaletteColor({ role: 'a' }, { a: { role: 'b' }, b: { role: 'a' } })).toBeNull();
    expect(resolvePaletteColor('rgba(255,255,255,.8)', {})).toBeNull();
    expect(resolvePaletteColor([2, 0, 0, 1], {})).toBeNull();
  });
});
