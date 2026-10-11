import { describe, expect, it } from 'vitest';
import { isUnpaintedBootstrapBoxShadow } from './bootstrap-disabled-paint';

const zero = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';

describe('Bootstrap disabled computed box-shadow oracle', () => {
  it.each(['none', `${zero}, ${zero}, ${zero}`])(
    'accepts generated no-paint value: %s',
    (shadow) => {
      expect(isUnpaintedBootstrapBoxShadow(shadow)).toBe(true);
    }
  );

  // Fixed Bootstrap 2.3.2 buttons.less raised and active values, serialized by
  // the supported Chromium CSSOM. Neither is disabled paint.
  it.each([
    `${zero}, ${zero}, rgba(255, 255, 255, 0.2) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`,
    `${zero}, ${zero}, rgba(0, 0, 0, 0.15) 0px 2px 4px 0px inset, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`,
    `${zero}, rgb(0, 85, 170) 0px 0px 0px 2px, ${zero}`,
    `${zero}, ${zero}, rgba(0, 0, 0, 0.05) 0px 0px 0px 0px`,
    `${zero}, ${zero}, rgba(0, 0, 0, 0) 0px 1px 0px 0px`,
    `${zero}, ${zero}, ${zero} inset`,
    `${zero}, ${zero}`,
    '',
  ])('rejects anything outside the exact no-paint outputs: %s', (shadow) => {
    expect(isUnpaintedBootstrapBoxShadow(shadow)).toBe(false);
  });
});
