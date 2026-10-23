// @vitest-environment node
import { expect, it } from 'vitest';
import { hasZeroTransparentTreeShadow } from './code-tree-shadow-evidence';

const zero = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
const composed = [zero, zero, zero].join(', ');
it('accepts no shadow or exactly the three transparent zero-geometry composed layers', () => {
  expect(hasZeroTransparentTreeShadow('none')).toBe(true);
  expect(hasZeroTransparentTreeShadow(composed)).toBe(true);
});
it('rejects nonzero alpha, offset, blur or spread in any composed layer', () => {
  const invalid = [
    'rgba(0, 0, 0, 0.01) 0px 0px 0px 0px',
    'rgba(0, 0, 0, 0) 1px 0px 0px 0px',
    'rgba(0, 0, 0, 0) 0px -1px 0px 0px',
    'rgba(0, 0, 0, 0) 0px 0px 1px 0px',
    'rgba(0, 0, 0, 0) 0px 0px 0px 1px',
  ];
  for (let index = 0; index < 3; index++) {
    for (const layer of invalid) {
      const layers = [zero, zero, zero]; layers[index] = layer;
      expect(hasZeroTransparentTreeShadow(layers.join(', '))).toBe(false);
    }
  }
  for (const value of ['', zero, composed + ', ' + zero, 'inset ' + composed])
    expect(hasZeroTransparentTreeShadow(value)).toBe(false);
});
