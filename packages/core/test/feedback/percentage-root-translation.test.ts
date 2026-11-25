import { describe, expect, it } from 'vitest';
import { FeedbackStyleRecorder, tw } from '../../src';
import { lowerRootStyleTokens } from '../../src/internal';
import { classifyTwTokenApplicationRoleV0 } from '../../src/spec/feedback/application-role';

// Independent finite spelling inventory from the draft criterion. These checks
// do not stand in for owner-source or native geometry admission.
const translations = [
  'translate-x-[calc(100%_-_4px)]',
  'translate-x-[calc((100%_-_2px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((100%_-_4px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((100%_-_8px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((2px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc((4px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc((8px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc(1px_+_(100%_+_1px)*var(--pui-percentage)/100)]',
  'translate-x-[calc(-1px_-_(100%_+_1px)*var(--pui-percentage)/100)]',
  'translate-x-[calc(0.0625rem_+_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/100)]',
  'translate-x-[calc(-0.0625rem_-_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/100)]',
  'translate-x-[-0.0625rem]',
  'translate-x-[calc(-100%_-_2px)]',
  'translate-x-[calc(2px_-_100%)]',
  'translate-x-[calc(4px_-_100%)]',
  'translate-x-[calc(8px_-_100%)]',
];

describe('draft finite percentage Root translation provenance', () => {
  it.each(translations)('preserves %s through Rule lowering and runtime replacement', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'root-geometry',
      roleSource: 'canonical',
    });
    const recorder = new FeedbackStyleRecorder();
    const handle = tw(token);
    recorder.use(handle);
    expect(handle).toEqual({ kind: 'tw', tokens: [token] });
    const lowered = lowerRootStyleTokens([token], 'data-[draggable]');
    const remove = recorder.useUnsafe(lowered);
    expect(lowered.entries).toEqual([
      {
        token: `data-[draggable]:${token}`,
        authorToken: token,
        role: 'root-geometry',
        roleSource: 'canonical',
        origin: 'rule',
      },
    ]);
    expect(recorder.exportRootEffect().entries.at(-1)).toEqual(lowered.entries[0]);
    recorder.patch(tw('translate-x-0'));
    expect(recorder.exportRootEffect().entries.at(-1)).toMatchObject({
      authorToken: 'translate-x-0',
      origin: 'runtime',
      role: 'root-geometry',
    });
    recorder.clearPatch();
    remove();
    expect(recorder.export()).toEqual({ tokens: [token] });
  });

  it.each([
    'translate-x-[calc((100%_-_3px)*var(--pui-percentage)/100)]',
    'translate-x-[calc((100%_-_2px)*var(--percentage)/100)]',
    'translate-x-[calc((100%_-_2px)*var(--pui-percentage)/10)]',
    'translate-x-[calc((100%_-_2px)_*_var(--pui-percentage)/100)]',
    'translate-y-[calc((100%_-_2px)*var(--pui-percentage)/100)]',
    '-translate-x-[calc((100%_-_2px)*var(--pui-percentage)/100)]',
    'translate-x-[calc(100%_-_6px)]',
    'translate-x-[var(--pui-percentage)]',
    'translate-x-[-0.125rem]',
    'translate-y-[-0.0625rem]',
    'translate-x-[calc(-0.0625rem)]',
    'translate-x-[calc(3px_-_100%)]',
    'translate-x-[calc(-100%_-_3px)]',
    'translate-x-[calc(0.125rem_+_(100%_+_2px_-_0.125rem)*var(--pui-percentage)/100)]',
    'translate-x-[calc(0.0625rem_+_(100%_+_2px_-_0.0625rem)*var(--percentage)/100)]',
    'translate-x-[calc(-0.0625rem_-_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/10)]',
    'translate-x-[calc(-0.0625rem_-_(100%_+_2px_-_0.0625rem)_*_var(--pui-percentage)/100)]',
  ])('keeps the non-admitted near miss %s unresolved', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'unresolved',
      roleSource: 'unresolved',
    });
  });
});
