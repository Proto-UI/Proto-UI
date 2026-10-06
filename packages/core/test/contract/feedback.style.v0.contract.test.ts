import { describe, it, expect } from 'vitest';
import { FeedbackStyleRecorder, tw } from '@proto.ui/core';

describe('core: feedback.style v0 contract', () => {
  it('records tw handles and exports merged tokens deterministically', () => {
    const r = new FeedbackStyleRecorder();

    r.use(tw('bg-red-500 text-white'));
    r.use(tw('bg-blue-500')); // bg- last wins
    r.use(tw('p-2'), tw('p-4')); // spacing group last wins within input order

    const out1 = r.export().tokens;
    const out2 = r.export().tokens;

    // Deterministic snapshot
    expect(out1).toEqual(out2);

    // Semantic merge last-wins per group (bg-, text-, p-)
    expect(out1).toContain('bg-blue-500');
    expect(out1).toContain('text-white');
    expect(out1).toContain('p-4');

    // Earlier conflicting tokens should not remain
    expect(out1).not.toContain('bg-red-500');
    expect(out1).not.toContain('p-2');
  });

  it('unUse removes the exact contribution of its use call', () => {
    const r = new FeedbackStyleRecorder();

    const unUseA = r.use(tw('bg-red-500 text-white'));
    r.use(tw('bg-blue-500')); // overrides bg group
    const outBefore = r.export().tokens;

    // Remove A: should remove text-white, but bg stays (still from bg-blue-500)
    unUseA();
    const outAfter = r.export().tokens;

    expect(outBefore).toContain('bg-blue-500');
    expect(outAfter).toContain('bg-blue-500');

    expect(outBefore).toContain('text-white');
    expect(outAfter).not.toContain('text-white');
  });

  it('allows only the static text-selection pseudo-element variant in v0', () => {
    const r = new FeedbackStyleRecorder();

    r.use(tw('selection:bg-primary selection:text-primary-foreground'));
    expect(r.export().tokens).toEqual([
      'selection:bg-primary',
      'selection:text-primary-foreground',
    ]);

    // Every other variant remains forbidden, including nested and chained selection variants.
    expect(() => r.use(tw('data-[disabled]:opacity-50'))).toThrow();
    expect(() => r.use(tw('hover:selection:bg-primary'))).toThrow();
    expect(() => r.use(tw('selection:hover:bg-primary'))).toThrow();
    expect(() => r.use(tw('selection:data-[disabled]:opacity-50'))).toThrow();
    expect(() => r.use(tw('&:hover'))).toThrow();
  });

  it.each(['auto', 'text', 'none'])(
    'rejects selection:select-%s as a highlight affordance',
    (value) => {
      const recorder = new FeedbackStyleRecorder();
      expect(() => recorder.use(tw(`selection:select-${value}`))).toThrow(/subject/);
      expect(recorder.export().tokens).toEqual([]);
    }
  );

  it('accepts arbitrary values and decimal-like tokens when no variant syntax is present', () => {
    const r = new FeedbackStyleRecorder();

    r.use(
      tw(
        'gap-1.5 px-2.5 text-[0.8rem] rounded-[min(var(--radius-md),12px)] bg-[var(--brand-surface)]'
      )
    );

    const out = r.export().tokens;
    expect(out).toContain('gap-1.5');
    expect(out).toContain('px-2.5');
    expect(out).toContain('text-[0.8rem]');
    expect(out).toContain('rounded-[min(var(--radius-md),12px)]');
    expect(out).toContain('bg-[var(--brand-surface)]');
  });

  it.each([
    'selection:*',
    'selection:foo*bar',
    "selection:content-['x]>button",
    'selection:w-[calc(100%+2px)',
    'selection:w-[2px]]',
    'selection:trailing\\',
    'selection:w-[var(--x,[2px])',
    String.raw`selection:custom\\*token`,
    'selection:&foo',
    'selection:foo>bar',
    'selection:foo+bar',
    'selection:foo~bar',
    'selection:foo,bar',
    'selection:foo|bar',
    'selection:foo#bar',
    'selection:foo.bar',
    'selection:[disabled]',
    'selection:button[disabled]',
    String.raw`selection:foo\\>bar`,
    "selection:content-['[']>button",
  ])('rejects selector structure outside selection arbitrary values: %s', (token) => {
    const recorder = new FeedbackStyleRecorder();
    expect(() => recorder.use(tw(token))).toThrow();
    expect(recorder.export().tokens).toEqual([]);
  });

  it.each([
    'selection:gap-1.5',
    'selection:px-2.5',
    'selection:text-[0.8rem]',
    'selection:w-[calc(100%+var(--space))]',
    'selection:w-[calc(2*var(--space))]',
    String.raw`selection:custom\*token`,
    String.raw`selection:content-['it\'s']`,
    'selection:rounded-[min(var(--radius-md),12px)]',
    'selection:bg-[#ffffff]',
    "selection:content-['>']",
    "selection:content-['[']",
    String.raw`selection:content-[\[]`,
    String.raw`selection:custom\>token`,
  ])('preserves non-selector selection values and escaped data: %s', (token) => {
    const recorder = new FeedbackStyleRecorder();
    expect(() => recorder.use(tw(token))).not.toThrow();
    expect(recorder.export().tokens).toContain(token);
  });
});
