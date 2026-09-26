import { describe, expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '../../src';
import { lowerRootStyleTokens } from '../../src/internal';
import { classifyTwTokenApplicationRoleV0 } from '../../src/spec/feedback/application-role';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 P/G/H/E/F: classification, not browser layout.
describe('I1 exact Root domains', () => {
  it.each([
    ['hidden', 'root-participation'],
    ['relative', 'root-geometry'],
  ])('%s has canonical provenance', (token, role) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role,
      roleSource: 'canonical',
    });
  });
  it.each([
    '-hidden',
    '-relative',
    'invisible',
    'visible',
    'collapse',
    'overflow-hidden',
    'translate-x-2',
  ])('does not admit %s', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token).role).toBe('unresolved');
  });
  it('preserves setup, lowering, patch, suppression and restoration without changing public snapshots', () => {
    const recorder = new FeedbackStyleRecorder();
    const base = tw('block relative');
    recorder.use(base);
    const lowered = lowerRootStyleTokens(['hidden', 'relative'], 'data-[inactive]');
    const remove = recorder.useUnsafe(lowered);
    expect(lowered.entries.map((e) => [e.authorToken, e.role, e.origin])).toEqual([
      ['hidden', 'root-participation', 'rule'],
      ['relative', 'root-geometry', 'rule'],
    ]);
    expect(recorder.exportRootEffect().entries.slice(-2)).toEqual(lowered.entries);
    recorder.patch(tw('hidden'));
    expect(recorder.exportRootEffect().entries.find((e) => e.token === 'hidden')).toMatchObject({
      origin: 'runtime',
      role: 'root-participation',
    });
    // I1 does not change the existing conservative semantic groups.
    expect(recorder.export().tokens).toContain('block');
    recorder.suppress(tw('hidden'));
    expect(recorder.export().tokens).not.toContain('hidden');
    recorder.clearPatch();
    remove();
    expect(recorder.export()).toEqual({ tokens: ['block', 'relative'] });
    expect(base).toEqual({ kind: 'tw', tokens: ['block', 'relative'] });
    expect(() => recorder.use(tw('surface:hidden'))).toThrow();
  });
});
