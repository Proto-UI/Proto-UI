import { describe, expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '@proto.ui/core';
import { FEEDBACK_STYLE_RUNTIME_PATCH_CASES } from '@proto.ui/spec-fixtures/feedback/style-runtime-patch';

describe('core: feedback.style runtime patch v0 contract', () => {
  it('keeps fixture coverage aligned with the runtime patch cases', () => {
    expect(FEEDBACK_STYLE_RUNTIME_PATCH_CASES.map((testCase) => testCase.specCase)).toEqual([
      'T-FEEDBACK-STYLE-0002-CASE-PATCH',
      'T-FEEDBACK-STYLE-0002-CASE-SUPPRESS',
      'T-FEEDBACK-STYLE-0002-CASE-CLEAR-PATCH',
      'T-FEEDBACK-STYLE-0002-CASE-PATCH-TOKEN-PURITY',
      'T-FEEDBACK-STYLE-0002-CASE-NO-RENDER',
    ]);
  });

  it('applies patch after the base semantic result, with same-group last write winning', () => {
    const recorder = new FeedbackStyleRecorder();

    recorder.use(tw('opacity-50 bg-blue-500 text-white'));
    recorder.patch(tw('opacity-100'));

    expect(recorder.export().tokens).toEqual(['bg-blue-500', 'text-white', 'opacity-100']);

    recorder.patch(tw('opacity-25'));
    expect(recorder.export().tokens).toEqual(['bg-blue-500', 'text-white', 'opacity-25']);
  });

  it('suppresses a semantic group from the base result without undoing historical patches', () => {
    const recorder = new FeedbackStyleRecorder();

    recorder.use(tw('opacity-50 bg-blue-500 text-white'));
    recorder.patch(tw('opacity-100'));
    recorder.suppress(tw('opacity-50'));

    expect(recorder.export().tokens).toEqual(['bg-blue-500', 'text-white']);

    recorder.patch(tw('opacity-25'));
    expect(recorder.export().tokens).toEqual(['bg-blue-500', 'text-white', 'opacity-25']);
  });

  it('keeps different semantic groups independent and clearPatch restores the base result', () => {
    const recorder = new FeedbackStyleRecorder();

    recorder.use(tw('opacity-50 bg-blue-500 text-white'));
    recorder.patch(tw('opacity-100 bg-red-500'));
    recorder.suppress(tw('text-white'));

    expect(recorder.export().tokens).toEqual(['opacity-100', 'bg-red-500']);

    recorder.clearPatch();
    expect(recorder.export().tokens).toEqual(['opacity-50', 'bg-blue-500', 'text-white']);
  });

  it('keeps directional colors in the v0 border-color group for patch and suppression', () => {
    for (const direction of ['t', 'r', 'b', 'l', 'x', 'y']) {
      const recorder = new FeedbackStyleRecorder();
      const token = `border-${direction}-transparent`;
      recorder.use(tw(`border-2 ${token}`));
      recorder.patch(tw('border-foreground'));
      expect(recorder.export().tokens).toEqual(['border-2', 'border-foreground']);
      recorder.suppress(tw('border-foreground'));
      expect(recorder.export().tokens).toEqual(['border-2']);
      recorder.clearPatch();
      expect(recorder.export().tokens).toEqual(['border-2', token]);
    }
  });

  it('keeps a four-side arbitrary border color in that same v0 group', () => {
    const recorder = new FeedbackStyleRecorder();
    const token = 'border-[transparent_currentColor_currentColor_currentColor]';
    recorder.use(tw(`border-2 ${token}`));
    expect(recorder.export().tokens).toEqual(['border-2', token]);
    recorder.patch(tw('border-foreground'));
    expect(recorder.export().tokens).toEqual(['border-2', 'border-foreground']);
    recorder.suppress(tw('border-current'));
    expect(recorder.export().tokens).toEqual(['border-2']);
  });

  it('validates runtime patch inputs as author-side feedback.style token handles', () => {
    const recorder = new FeedbackStyleRecorder();

    expect(() => recorder.patch(tw('hover:opacity-100'))).toThrow();
    expect(() => recorder.suppress(tw('data-[disabled]:opacity-50'))).toThrow();
    expect(() => recorder.patch({ kind: 'tw', tokens: ['data-pui-style'] })).toThrow();
  });
});
