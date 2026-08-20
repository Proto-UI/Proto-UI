import { describe, it, expect } from 'vitest';
import { mergeTwTokensV0 } from '../../src/spec/feedback/semantic-merge';

describe('feedback.semantic-merge.v0', () => {
  it('last-wins within same semantic group', () => {
    const r = mergeTwTokensV0(['bg-red-500', 'bg-blue-500']);
    expect(r.tokens).toEqual(['bg-blue-500']);
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
