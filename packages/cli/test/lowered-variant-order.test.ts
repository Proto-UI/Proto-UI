import { describe, expect, it } from 'vitest';

import { canonicalizeLoweredVariants } from '../src/generated/lowered-variant-order';

// The runtime writes the class onto the host and this extractor writes the
// stylesheet, so the two only meet if they canonicalize a rule's variants the
// same way. That is now one generated source; these cases cover what it means.
describe('canonicalizeLoweredVariants', () => {
  it('does not depend on the order the conditions were authored', () => {
    const authored = ['data-[hovered]', 'not-[data-selected]', 'not-[data-pressed]'];
    const reordered = ['not-[data-pressed]', 'data-[hovered]', 'not-[data-selected]'];
    expect(canonicalizeLoweredVariants(authored)).toEqual(canonicalizeLoweredVariants(reordered));
  });

  it('collapses a condition that lowers more than once', () => {
    expect(canonicalizeLoweredVariants(['data-[hovered]', 'data-[hovered]'])).toEqual([
      'data-[hovered]',
    ]);
  });

  it('ranks the named variants ahead of data selectors', () => {
    expect(canonicalizeLoweredVariants(['not-[data-checked]', 'dark'])).toEqual([
      'dark',
      'not-[data-checked]',
    ]);
    expect(canonicalizeLoweredVariants(['disabled', 'hover', 'dark'])).toEqual([
      'dark',
      'hover',
      'disabled',
    ]);
  });

  it('keeps the Brutalist Tabs trigger hover class the stylesheet carries', () => {
    expect(
      canonicalizeLoweredVariants([
        'data-[hovered]',
        'not-[data-selected]',
        'not-[data-pressed]',
      ]).join(':')
    ).toBe('data-[hovered]:not-[data-pressed]:not-[data-selected]');
  });
});
