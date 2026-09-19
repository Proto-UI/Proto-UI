import { describe, expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '../../src';
import { lowerRootStyleTokens } from '../../src/internal';
import { classifyTwTokenApplicationRoleV0 } from '../../src/spec/feedback/application-role';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-L/G/H/E/F. No physical browser claim.
const geometry = [
  'translate-y-px',
  'translate-x-0',
  'translate-x-[calc(100%_-_2px)]',
  'scale-[0.98]',
  'will-change-transform',
];
describe('H1 bounded Root domain provenance', () => {
  it.each([...geometry.map((t) => [t, 'root-geometry']), ['pointer-events-none', 'hit-testing']])(
    'classifies %s independently from paint and placement',
    (token, role) => {
      expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
        token,
        role,
        roleSource: 'canonical',
      });
    }
  );
  it.each([
    '-translate-y-px',
    'translate-x-2',
    'translate-y-0',
    'scale-95',
    'scale-[0.97]',
    'pointer-events-auto',
    'will-change-auto',
    'will-change-contents',
    'origin-center',
    'rotate-45',
    'skew-x-2',
    'transform',
    'invisible',
    'collapse',
    'overflow-hidden',
  ])('does not broaden H1 to %s', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token).role).toBe('unresolved');
  });
  it('preserves both domains through lowered Rule, runtime patch, suppress and clear', () => {
    const recorder = new FeedbackStyleRecorder();
    const handle = tw('translate-x-0 pointer-events-none will-change-transform');
    recorder.use(handle);
    const lowered = lowerRootStyleTokens(
      ['translate-x-[calc(100%_-_2px)]', 'pointer-events-none'],
      'data-[checked]'
    );
    const remove = recorder.useUnsafe(lowered);
    expect(recorder.exportRootEffect().entries.slice(-2)).toEqual(lowered.entries);
    expect(lowered.entries.map((e) => e.role)).toEqual(['root-geometry', 'hit-testing']);
    recorder.patch(tw('scale-[0.98]'));
    expect(recorder.exportRootEffect().entries.at(-1)).toMatchObject({
      role: 'root-geometry',
      origin: 'runtime',
    });
    recorder.suppress(tw('pointer-events-none'));
    expect(recorder.exportRootEffect().entries.some((e) => e.token === 'pointer-events-none')).toBe(
      false
    );
    recorder.clearPatch();
    remove();
    expect(recorder.export()).toEqual({ tokens: handle.tokens });
    expect(handle).toEqual({
      kind: 'tw',
      tokens: ['translate-x-0', 'pointer-events-none', 'will-change-transform'],
    });
  });
});
