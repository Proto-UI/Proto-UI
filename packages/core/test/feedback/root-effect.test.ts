import { describe, expect, it } from 'vitest';
import { FeedbackStyleRecorder, mergeTwTokensV0, tw } from '../../src';
import { lowerRootStyleTokens, readRootStyleEntries } from '../../src/internal';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 E-H: transport changes no token semantics.
describe('Root effect provenance', () => {
  it('keeps winning entries and first-group order without adding author metadata', () => {
    const recorder = new FeedbackStyleRecorder();
    const handle = tw('w-2 bg-white w-full theme-extension');
    recorder.use(handle);
    expect(handle).toEqual({
      kind: 'tw',
      tokens: ['w-2', 'bg-white', 'w-full', 'theme-extension'],
    });
    const effect = recorder.exportRootEffect();
    expect(effect.tokens).toEqual(mergeTwTokensV0(handle.tokens).tokens);
    expect(effect.entries).toEqual([
      {
        token: 'w-full',
        authorToken: 'w-full',
        role: 'placement',
        roleSource: 'canonical',
        origin: 'setup',
      },
      {
        token: 'bg-white',
        authorToken: 'bg-white',
        role: 'surface',
        roleSource: 'canonical',
        origin: 'setup',
      },
      {
        token: 'theme-extension',
        authorToken: 'theme-extension',
        role: 'surface',
        roleSource: 'fallback',
        origin: 'setup',
      },
    ]);
    expect(recorder.export()).toEqual({ tokens: effect.tokens });
  });

  it('preserves Rule, patch, suppress, clear and removal origins', () => {
    const recorder = new FeedbackStyleRecorder();
    recorder.use(tw('w-2 bg-white'));
    const removeRule = recorder.useRuntime(tw('w-4'));
    expect(recorder.exportRootEffect().entries[0]).toMatchObject({ token: 'w-4', origin: 'rule' });
    recorder.patch(tw('w-8'));
    expect(recorder.exportRootEffect().entries.at(-1)).toMatchObject({
      token: 'w-8',
      role: 'placement',
      origin: 'runtime',
    });
    recorder.suppress(tw('w-1'));
    expect(recorder.export().tokens).toEqual(['bg-white']);
    recorder.clearPatch();
    expect(recorder.exportRootEffect().entries[0]).toMatchObject({ token: 'w-4', origin: 'rule' });
    removeRule();
    expect(recorder.exportRootEffect().entries[0]).toMatchObject({ token: 'w-2', origin: 'setup' });
  });

  it('preserves original roles in lowered and additional Rule contributions', () => {
    const recorder = new FeedbackStyleRecorder();
    recorder.use(tw('w-2'));
    const lowered = lowerRootStyleTokens(['w-full', 'bg-black', 'translate-x-2'], 'data-[checked]');
    const remove = recorder.useUnsafe(lowered);
    expect(recorder.exportRootEffect().entries.slice(1)).toEqual(lowered.entries);
    expect(lowered.entries[0]).toMatchObject({
      token: 'data-[checked]:w-full',
      authorToken: 'w-full',
      role: 'placement',
      origin: 'rule',
    });
    expect(lowered.entries[2].role).toBe('unresolved');
    remove();
    const additional = recorder.exportRootEffect(lowered);
    expect(additional.entries.slice(1)).toEqual(lowered.entries);
    expect(recorder.export().tokens).toEqual(['w-2']);
  });

  it('does not infer an author fallback for legacy unsafe selectors', () => {
    const recorder = new FeedbackStyleRecorder();
    recorder.useUnsafe(tw('data-[checked]:w-full'));
    expect(recorder.exportRootEffect().entries[0]).toMatchObject({
      role: 'unresolved',
      roleSource: 'unresolved',
    });
    expect(recorder.export().tokens).toEqual(['data-[checked]:w-full']);
  });

  it('isolates snapshot mutations and rejects mismatched internal provenance', () => {
    const recorder = new FeedbackStyleRecorder();
    recorder.use(tw('w-full'));
    const effect = recorder.exportRootEffect();
    expect(Object.isFrozen(effect.entries)).toBe(true);
    expect(Object.isFrozen(effect.entries[0])).toBe(true);
    effect.tokens[0] = 'bg-black';
    expect(recorder.exportRootEffect().tokens).toEqual(['w-full']);
    expect(() => readRootStyleEntries(effect, 'rule')).toThrow(/mismatch/);
    expect(() => recorder.useUnsafe(effect)).toThrow(/mismatch/);
    expect(recorder.export().tokens).toEqual(['w-full']);
  });

  it('keeps public colon validation and runtime patch rejection atomic', () => {
    const recorder = new FeedbackStyleRecorder();
    recorder.use(tw('w-2'));
    expect(() => recorder.use(tw('surface:bg-white'))).toThrow();
    expect(() => recorder.patch(tw('w-4 data-[checked]:w-8'))).toThrow();
    expect(recorder.export().tokens).toEqual(['w-2']);
  });
});
