// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { contactPaintOutset } from '../../../../../packages/adapters/base/src/material/contact-profile';
import demo from './demo_components/liquid-glass/demo-liquid-glass-button.demo';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { compile } = require('tailwindcss') as typeof import('tailwindcss');

// Native observations from CI run 44799728866, candidate 9d5a3881:
// the public light/dark/390px views used these same button dimensions.
// This checks authored CSS against the real contact profile and those measured
// dimensions. It does not simulate browser flex layout or prove optical paint.
const observed = {
  back: { width: 73.125, height: 38 },
  continue: { width: 98.046875, height: 38 },
  unavailable: { width: 115.171875, height: 38 },
};
const outset = (name: keyof typeof observed) =>
  contactPaintOutset(observed[name].width, observed[name].height);
let gapPx: number;

beforeAll(async () => {
  const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const compiler = await compile(`${theme}\n@tailwind utilities;`);
  const css = compiler.build(demo.root.className.split(/\s+/));
  const spacing = css.match(/--spacing:\s*([\d.]+)rem;/);
  const gap = css.match(/\bgap:\s*calc\(var\(--spacing\)\s*\*\s*([\d.]+)\);/);
  expect(spacing, 'compiled default spacing').not.toBeNull();
  expect(gap, 'one gap declaration applies to both flex axes').not.toBeNull();
  // The CI observation used the default 16px root font, not a zoom simulation.
  gapPx = Number(spacing![1]) * 16 * Number(gap![1]);
});

describe('public Liquid Glass Button contact-paint spacing budget', () => {
  it('separates the Back carrier from the complete Continue sampling box', () => {
    expect(gapPx - outset('back') - outset('continue')).toBeGreaterThan(0);
  });

  it('reserves complete neighboring footprints, including across wrapped rows', () => {
    // Unavailable currently has no optical carrier. Reserving its complete
    // profile as well keeps the layout independent of a disabled-state shortcut.
    const largestPair = outset('continue') + outset('unavailable');
    expect(gapPx - largestPair).toBeGreaterThan(0);
  });

  it('still fits both active controls within the observed narrow content width', () => {
    // 300.75px surface minus its two 1px borders and two 24px content insets.
    // This is a width budget; the real browser recheck owns wrapping evidence.
    const available = 300.75 - 2 - 2 * 24;
    expect(observed.back.width + gapPx + observed.continue.width).toBeLessThan(available);
  });
});
