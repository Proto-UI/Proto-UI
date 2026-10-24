import { expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '@proto.ui/core';
import { mergeTwTokensV0 } from '../../src/spec/feedback/semantic-merge';
import { resolveRootStyleEntry } from '../../src/spec/feedback/root-effect';
const colors = ['foreground', 'muted-foreground', 'primary', 'destructive'];
it.each(colors)(
  'admits only static placeholder color %s with canonical surface provenance',
  (color) => {
    const token = `placeholder:text-${color}`,
      recorder = new FeedbackStyleRecorder();
    recorder.use(tw(token));
    expect(recorder.export().tokens).toEqual([token]);
    expect(resolveRootStyleEntry(token, 'setup')).toMatchObject({
      role: 'surface',
      roleSource: 'canonical',
    });
  }
);
it('keeps placeholder color conflicts separate from element and selection paint', () => {
  expect(
    mergeTwTokensV0([
      'text-foreground',
      'selection:text-primary',
      'placeholder:text-primary',
      'placeholder:text-muted-foreground',
    ]).tokens
  ).toEqual(['text-foreground', 'selection:text-primary', 'placeholder:text-muted-foreground']);
});
it.each([
  'placeholder:text-sm',
  'placeholder:opacity-50',
  'placeholder:bg-primary',
  'placeholder:text-primary/50',
  'placeholder:text-unknown',
  'placeholder:text-[#fff]',
  'placeholder:hover:text-primary',
  'hover:placeholder:text-primary',
  'placeholder:selection:text-primary',
  'placeholder:*',
  'placeholder:text-primary>button',
])('rejects non-admitted author token %s', (token) => {
  const recorder = new FeedbackStyleRecorder();
  expect(() => recorder.use(tw(token))).toThrow();
  expect(resolveRootStyleEntry(token, 'setup').role).toBe('unresolved');
});
