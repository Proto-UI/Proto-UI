import { describe, expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '../../src';
import { lowerRootStyleTokens } from '../../src/internal';
import { classifyTwTokenApplicationRoleV0 as classify } from '../../src/spec/feedback/application-role';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 S/T: semantic admission, not browser evidence.
describe('K1 exact half-translation domains', () => {
  it.each(['-translate-x-1/2', '-translate-y-1/2'])(
    'classifies %s and preserves transport',
    (token) => {
      expect(classify(token)).toEqual({ token, role: 'root-geometry', roleSource: 'canonical' });
      const recorder = new FeedbackStyleRecorder();
      recorder.use(tw(token));
      const lowered = lowerRootStyleTokens([token], 'data-[open]');
      const remove = recorder.useUnsafe(lowered);
      expect(recorder.exportRootEffect().entries.at(-1)).toMatchObject({
        authorToken: token,
        token: `data-[open]:${token}`,
        role: 'root-geometry',
        origin: 'rule',
      });
      remove();
      expect(recorder.export()).toEqual({ tokens: [token] });
      recorder.patch(tw(token));
      expect(recorder.exportRootEffect().entries.at(-1)?.origin).toBe('runtime');
    }
  );
  it.each([
    'translate-x-1/2',
    '-translate-x-1/3',
    '-translate-y-full',
    'scale-95',
    'origin-center',
  ])('does not broaden %s', (token) => expect(classify(token).role).toBe('unresolved'));
  it.each(['animate-in', 'animate-out', 'fade-in-0', 'zoom-out-95'])(
    'retains canonical surface ownership for %s',
    (token) => expect(classify(token).role).toBe('surface')
  );
});
