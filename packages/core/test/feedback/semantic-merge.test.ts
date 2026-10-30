import { describe, it, expect } from 'vitest';
import { mergeTwTokensV0 } from '../../src/spec/feedback/semantic-merge';

describe('feedback.semantic-merge.v0', () => {
  it('replaces signed layout spacing and scroll padding without merging scroll margins', () => {
    expect(mergeTwTokensV0([
      'mx-2', 'mb-1', 'scroll-my-1', 'scroll-py-1', '-mx-4', '-mb-4', 'scroll-py-1.5',
    ]).tokens).toEqual(['-mx-4', '-mb-4', 'scroll-my-1', 'scroll-py-1.5']);
    expect(mergeTwTokensV0(['-mx-4', 'mx-2', '-mb-4', 'mb-1']).tokens).toEqual(['mx-2', 'mb-1']);
  });

  it('keeps explicit linear timing separate from the transition-property recipe', () => {
    expect(mergeTwTokensV0(['ease-in-out', 'transition-shadow', 'ease-linear']).tokens)
      .toEqual(['ease-linear', 'transition-shadow']);
    expect(mergeTwTokensV0(['ease-linear', 'ease-in-out']).tokens).toEqual(['ease-in-out']);
  });

  it('preserves border width and balanced text when source colors are replaced', () => {
    expect(
      mergeTwTokensV0([
        'border',
        'border-[3px]',
        'border-[#ccc]',
        'border-[#953b39]',
        'text-balance',
        'text-sm',
        'text-[#333]',
        'text-[#08c]',
      ]).tokens
    ).toEqual(['border-[3px]', 'border-[#953b39]', 'text-balance', 'text-sm', 'text-[#08c]']);
  });

  it('replaces finite placement and weight without losing font family or focus color', () => {
    expect(
      mergeTwTokensV0([
        'box-border',
        'float-left',
        'font-sans',
        'font-bold',
        'z-50',
        'ring-primary',
        'box-content',
        'float-right',
        'font-[100]',
        'z-[1051]',
      ]).tokens
    ).toEqual([
      'box-content',
      'float-right',
      'font-sans',
      'font-[100]',
      'z-[1051]',
      'ring-primary',
    ]);
  });

  it('keeps table layout independent of border paint and resolves cell alignment separately', () => {
    expect(
      mergeTwTokensV0([
        'block',
        'table',
        'border-collapse',
        'border-spacing-0',
        'border-y',
        'border-border',
        'border-b-input',
        'border-b-ring',
        'align-top',
        'align-middle',
      ]).tokens
    ).toEqual([
      'table',
      'border-collapse',
      'border-spacing-0',
      'border-y',
      'border-border',
      'border-b-ring',
      'align-middle',
    ]);
    expect(mergeTwTokensV0(['table-cell', 'table-caption', 'caption-bottom']).tokens).toEqual([
      'table-caption',
      'caption-bottom',
    ]);
  });

  it('replaces one endpoint radius without erasing the opposite endpoint or whole-box base', () => {
    expect(
      mergeTwTokensV0(['rounded-none', 'rounded-l-md', 'rounded-r-md', 'rounded-l-lg']).tokens
    ).toEqual(['rounded-none', 'rounded-l-lg', 'rounded-r-md']);
    expect(
      mergeTwTokensV0(['rounded-t-[4px]', 'rounded-b-[6px]', 'rounded-t-[3px]']).tokens
    ).toEqual(['rounded-t-[3px]', 'rounded-b-[6px]']);
  });

  it('replaces literal foreground and tracking independently of font size and transition duration', () => {
    expect(
      mergeTwTokensV0([
        'text-sm',
        'text-[#08c]',
        'text-[#005580]',
        'tracking-wide',
        'tracking-wider',
        'transition-all',
        'duration-100',
        'transition-[color,border-color]',
      ]).tokens
    ).toEqual([
      'text-sm',
      'text-[#005580]',
      'tracking-wider',
      'transition-[color,border-color]',
      'duration-100',
    ]);
  });

  it('merges finite sizing and resize choices independently without absorbing unknown tokens', () => {
    expect(
      mergeTwTokensV0(['resize-y', 'field-sizing-content', 'resize-none', 'field-sizing-fixed'])
        .tokens
    ).toEqual(['resize-none', 'field-sizing-fixed']);
    expect(
      mergeTwTokensV0(['resize-none', 'resize-y', 'field-sizing-fixed', 'field-sizing-content'])
        .tokens
    ).toEqual(['resize-y', 'field-sizing-content']);
    expect(
      mergeTwTokensV0(['resize-auto', 'resize-none', 'field-sizing-auto', 'field-sizing-content'])
        .tokens
    ).toEqual(['resize-auto', 'resize-none', 'field-sizing-auto', 'field-sizing-content']);
  });
  it('preserves unknown tokens that resemble the internal selection group', () => {
    expect(mergeTwTokensV0(['user-select', 'select-none', 'select-text']).tokens).toEqual([
      'user-select',
      'select-text',
    ]);
    expect(mergeTwTokensV0(['select-none', 'user-select']).tokens).toEqual([
      'select-none',
      'user-select',
    ]);
  });
  it('resolves content-selection affordances last-wins without merging selection paint', () => {
    // T-CONTENT-SELECTION-AFFORDANCE-0001-CASE-MERGE
    expect(
      mergeTwTokensV0(['select-none', 'selection:bg-primary', 'select-text', 'select-auto']).tokens
    ).toEqual(['select-auto', 'selection:bg-primary']);
    expect(mergeTwTokensV0(['select-auto', 'select-text', 'select-none']).tokens).toEqual([
      'select-none',
    ]);
    expect(mergeTwTokensV0(['select-none', 'select-text']).tokens).toEqual(['select-text']);
  });

  it.each(['left', 'right', 'center', 'justify', 'start', 'end'])(
    'keeps foreground and font size when text-%s sets independent alignment',
    (alignment) => {
      expect(mergeTwTokensV0(['text-sm', 'text-foreground', `text-${alignment}`]).tokens).toEqual([
        'text-sm',
        'text-foreground',
        `text-${alignment}`,
      ]);
      expect(mergeTwTokensV0([`text-${alignment}`, 'text-sm', 'text-foreground']).tokens).toEqual([
        `text-${alignment}`,
        'text-sm',
        'text-foreground',
      ]);
    }
  );

  it('replaces alignment without erasing current theme foreground, including selection scope', () => {
    expect(
      mergeTwTokensV0(['text-left', 'text-foreground', 'text-right', 'text-primary']).tokens
    ).toEqual(['text-right', 'text-primary']);
    expect(
      mergeTwTokensV0([
        'selection:text-left',
        'selection:text-primary',
        'text-center',
        'selection:text-end',
      ]).tokens
    ).toEqual(['selection:text-end', 'selection:text-primary', 'text-center']);
  });
  it('last-wins within same semantic group', () => {
    const r = mergeTwTokensV0(['bg-red-500', 'bg-blue-500']);
    expect(r.tokens).toEqual(['bg-blue-500']);
  });

  it('merges selection utilities by their underlying style group, separately from element styles', () => {
    const r = mergeTwTokensV0([
      'bg-muted',
      'selection:bg-primary',
      'selection:text-primary-foreground',
      'selection:bg-secondary',
    ]);

    expect(r.tokens).toEqual([
      'bg-muted',
      'selection:bg-secondary',
      'selection:text-primary-foreground',
    ]);
  });

  it('fallback grouping: unknown tokens only conflict with identical token', () => {
    const r = mergeTwTokensV0(['foo', 'bar', 'foo']);
    // group order: foo first, bar second
    // last foo wins => foo, bar
    expect(r.tokens).toEqual(['foo', 'bar']);
  });

  it('output ordering follows first occurrence of each semantic group', () => {
    const r = mergeTwTokensV0(['text-red-500', 'bg-red-500', 'text-blue-500']);
    // groups first seen: text-, bg-
    // last-wins: text-blue-500, bg-red-500
    expect(r.tokens).toEqual(['text-blue-500', 'bg-red-500']);
  });

  it('does not merge text color with text size, or bg clip with bg color', () => {
    const r = mergeTwTokensV0(['text-sm', 'text-foreground', 'bg-clip-padding', 'bg-primary']);

    expect(r.tokens).toContain('text-sm');
    expect(r.tokens).toContain('text-foreground');
    expect(r.tokens).toContain('bg-clip-padding');
    expect(r.tokens).toContain('bg-primary');
  });

  it('does not merge display with flex direction', () => {
    const r = mergeTwTokensV0(['flex', 'flex-col', 'gap-3']);
    expect(r.tokens).toEqual(['flex', 'flex-col', 'gap-3']);
  });

  it('does not merge border width with border color', () => {
    const r = mergeTwTokensV0(['border', 'border-border/60', 'rounded-xl']);
    expect(r.tokens).toEqual(['border', 'border-border/60', 'rounded-xl']);
  });

  it('does not merge directional border width with border color', () => {
    const r = mergeTwTokensV0(['border-l-2', 'border-foreground', 'border-t-2', 'border-black']);

    expect(r.tokens).toEqual(['border-l-2', 'border-black', 'border-t-2']);
  });

  it('empty input -> empty output', () => {
    const r = mergeTwTokensV0([]);
    expect(r.tokens).toEqual([]);
  });
});

describe('resident translate-axis groups', () => {
  it('same-axis positive negative and affine targets replace without erasing the other axis', () => {
    expect(
      mergeTwTokensV0([
        'translate-x-0',
        'translate-y-2',
        '-translate-x-4',
        'translate-x-[calc(100%_-_2px)]',
      ]).tokens
    ).toEqual(['translate-x-[calc(100%_-_2px)]', 'translate-y-2']);
    expect(mergeTwTokensV0(['translate-y-full', '-translate-y-2', 'translate-x-1']).tokens).toEqual(
      ['-translate-y-2', 'translate-x-1']
    );
  });
  it('does not erase differently scoped variants or general transform channels', () => {
    expect(
      mergeTwTokensV0([
        'translate-x-0',
        'data-[checked]:translate-x-4',
        'hover:translate-x-2',
        '-translate-x-2',
        'rotate-45',
        'scale-95',
      ]).tokens
    ).toEqual([
      '-translate-x-2',
      'data-[checked]:translate-x-4',
      'hover:translate-x-2',
      'rotate-45',
      'scale-95',
    ]);
  });
});
