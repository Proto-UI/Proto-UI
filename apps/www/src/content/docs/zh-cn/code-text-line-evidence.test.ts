import { describe, expect, it } from 'vitest';
import { textFragmentsShareLine } from './code-text-line-evidence';
const rect = (top = 10, bottom = 30, width = 100) => ({ top, bottom, width, height: bottom - top });
describe('single-line Range evidence', () => {
  it('accepts one line and same-band ellipsis fragments without equating fragments with lines', () => {
    expect(textFragmentsShareLine([rect()])).toBe(true);
    expect(textFragmentsShareLine([rect(), rect(10, 30, 40)])).toBe(true);
    expect(textFragmentsShareLine([rect(), rect(10.5, 30.5, 40)])).toBe(true);
  });
  it('rejects separate, partially overlapping and chained line bands', () => {
    for (const next of [[rect(), rect(31, 51)], [rect(), rect(20, 40)], [rect(), rect(11, 31), rect(12, 32)], [rect(), rect(9, 29), rect(11, 31)]])
      expect(textFragmentsShareLine(next)).toBe(false);
  });
  it('rejects missing, non-finite, zero-size and inconsistent geometry', () => {
    expect(textFragmentsShareLine([])).toBe(false);
    for (const value of [rect(10, 10), rect(10, 30, 0), rect(10, 30, -1), rect(NaN), rect(10, Infinity), { ...rect(), height: -1 }, { ...rect(), height: 50 }])
      expect(textFragmentsShareLine([value])).toBe(false);
  });
});
