// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasNoVisibleBoxShadow } from './finf-box-shadow-observation';

// Exact selected.shadow observed in all four Runtime Tabs families at
// 2a67cb6173020c487591724538ca56e03f14a1ea, after their real keyboard/focus journeys.
const observedTransparentStack = Array(3).fill('rgba(0, 0, 0, 0) 0px 0px 0px 0px').join(', ');

describe('conservative computed box-shadow observation (not focus-ring acceptance)', () => {
  it('retains the real transparent three-layer red control for the old strict-none matcher', () => {
    expect(observedTransparentStack).not.toBe('none');
    expect(hasNoVisibleBoxShadow(observedTransparentStack)).toBe(true);
  });

  it.each([
    'none',
    '  none  ',
    'rgba(0, 0, 0, 0) 0px 0px 0px 0px',
    'rgb(0 0 0 / 0) 0px 0px',
    'rgb(0% 0% 0% / 0%) 1px 2px 3px 4px',
    'transparent -2px 3px 4px -1px',
    'inset transparent 0 0',
    '0px 0px 0px 0px rgb(0, 0, 0)',
    'rgb(255, 10, 0) -0px +0px 0.0px -0.0px inset',
    'inset rgb(0 0 0 / 1) 0px 0px 0px 0px',
    'transparent 0px 0px, rgb(255, 0, 0) 0px 0px',
  ])('accepts a fully parsed provably invisible value: %s', (value) => {
    expect(hasNoVisibleBoxShadow(value)).toBe(true);
  });

  it.each([
    'rgb(0, 0, 0) 1px 0px 0px 0px',
    'rgb(0, 0, 0) 0px -1px 0px 0px',
    'rgb(0, 0, 0) 0px 0px 1px 0px',
    'rgb(0, 0, 0) 0px 0px 0px 1px',
    'rgb(0, 0, 0) 0px 0px 0px -1px',
    'rgba(0, 0, 0, 0.001) 0px 0px 2px 0px',
    'rgb(0 0 0 / 1%) 0px 0px 0px 3px',
    'inset rgb(0, 0, 0) 1px 0px',
    `${observedTransparentStack}, rgba(0, 0, 0, 0.5) 0px 0px 0px 3px`,
    `rgb(0, 0, 0) 0px 2px 0px 0px, ${observedTransparentStack}`,
    'transparent 0px 0px, rgb(0 0 0 / 1) 1px 1px, transparent 0px 0px',
  ])('rejects any potentially visible layer, including focus-like rings: %s', (value) => {
    expect(hasNoVisibleBoxShadow(value)).toBe(false);
  });

  it.each([
    '',
    ' ',
    'none, none',
    '\u00a0none',
    'transparent 0px 0px\u00a0',
    'rgba(0,0,0,\u00a00) 0px 0px',
    `rgba(0,0,0,0.${'0'.repeat(400)}1) 1px 1px`,
    `rgba(0,0,0,0.${'0'.repeat(323)}5%) 1px 1px`,
    `rgb(0,0,0) 0.${'0'.repeat(400)}1px 0px`,
    'none, transparent 0px 0px',
    'transparent',
    'transparent 0px',
    'transparent 0px 0px 0px 0px 0px',
    'transparent 0px 0px -1px 0px',
    'transparent 0px 0px -0.1px',
    'transparent 1 0',
    'transparent 0% 0px',
    'transparent 1em 0px',
    'transparent 0e0px 0px',
    'transparent 1e-9999px 0px',
    'transparent NaNpx 0px',
    'transparent Infinitypx 0px',
    'rgba(0,0,0,1e-9999) 1px 1px',
    'rgba(0,0,0,NaN) 0px 0px',
    'rgba(0,0,0,Infinity) 0px 0px',
    'rgba(0,0,0,-1) 0px 0px',
    'rgba(0,0,0,2) 0px 0px',
    'rgba(999,0,0,0) 0px 0px',
    'rgb(0%, 0, 0) 0px 0px',
    'rgba(0,0,0,) 0px 0px',
    'rgba(0,0,0,0,0) 0px 0px',
    'rgb(0 0 / 0) 0px 0px',
    'rgb(0 0 0 / 0 / 0) 0px 0px',
    'rgba(0,0,0,0 0px 0px',
    'rgba(0,0,0,0)) 0px 0px',
    'rgba(var(--color),0) 0px 0px',
    'var(--shadow)',
    'lab(0 0 0 / 0) 0px 0px',
    'currentColor 0px 0px',
    '#0000 0px 0px',
    'inset inset transparent 0px 0px',
    'transparent transparent 0px 0px',
    'transparent 0px inset 0px',
    '0px transparent 0px',
    'transparent 0px 0px,',
    ',transparent 0px 0px',
    'transparent 0px 0px,, transparent 0px 0px',
    'transparent 0px 0px; color: red',
    'transparent 0px 0px garbage',
    'transparent 0px 0px, unknown 0px 0px',
  ])('fails closed on malformed or unsupported syntax: %s', (value) => {
    expect(hasNoVisibleBoxShadow(value)).toBe(false);
  });
});
