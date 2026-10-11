import { describe, it, expect } from 'vitest';
import { FeedbackStyleRecorder } from '../../src/spec/feedback/recorder';
import { tw } from '../../src/spec/feedback/style';

describe('feedback.recorder.v0', () => {
  it('patches and suppresses alignment without losing the style-owned fallback foreground', () => {
    const fb = new FeedbackStyleRecorder();
    fb.use(tw('text-sm text-foreground text-left'));
    fb.patch(tw('text-right'));
    expect(fb.export().tokens).toEqual(['text-sm', 'text-foreground', 'text-right']);
    fb.suppress(tw('text-center'));
    expect(fb.export().tokens).toEqual(['text-sm', 'text-foreground']);
    fb.clearPatch();
    expect(fb.export().tokens).toEqual(['text-sm', 'text-foreground', 'text-left']);
  });
  it('accumulates use() and exports merged snapshot', () => {
    const fb = new FeedbackStyleRecorder();

    fb.use(tw('bg-red-500'));
    fb.use(tw('bg-blue-500'), tw('text-red-500'));

    const out = fb.export();
    expect(out.tokens).toEqual(['bg-blue-500', 'text-red-500']);
  });

  it('unUse removes the exact use() contribution (setup-only)', () => {
    const fb = new FeedbackStyleRecorder();

    const u1 = fb.use(tw('bg-red-500'));
    fb.use(tw('text-red-500'));

    expect(fb.export().tokens).toEqual(['bg-red-500', 'text-red-500']);

    u1();

    expect(fb.export().tokens).toEqual(['text-red-500']);
  });

  it('forbidden token syntax throws', () => {
    const fb = new FeedbackStyleRecorder();

    expect(() => fb.use(tw('data-[disabled]:opacity-50'))).toThrow(); // contains ':'
    expect(() => fb.use(tw('.foo'))).toThrow(); // contains '.'
    expect(() => fb.use(tw('w-[1:2]'))).toThrow(); // bracket contains ':'
    expect(() => fb.use(tw('w-[1 2]'))).toThrow(); // bracket contains whitespace
  });

  it('export is pure snapshot (no mutation)', () => {
    const fb = new FeedbackStyleRecorder();

    fb.use(tw('bg-red-500'));
    const a = fb.export();
    const b = fb.export();
    expect(a).toEqual(b);
  });
});
