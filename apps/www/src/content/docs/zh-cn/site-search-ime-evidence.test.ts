import { describe, expect, it } from 'vitest';
import { nativeImeCommitTrace, type NativeImeEvent } from './site-search-ime-evidence';

const native = (endTrusted: boolean): NativeImeEvent[] => [
  { type: 'compositionstart', trusted: true, data: 'Button' },
  { type: 'compositionupdate', trusted: true, data: '中' },
  { type: 'beforeinput', trusted: true, composing: true, data: '中' },
  { type: 'input', trusted: true, composing: true, value: '中' },
  { type: 'compositionupdate', trusted: true, data: 'Button' },
  { type: 'beforeinput', trusted: true, composing: true, data: 'Button' },
  { type: 'input', trusted: true, composing: true, value: 'Button' },
  { type: 'compositionend', trusted: endTrusted, data: 'Button' },
];

describe('independent native Search IME oracle', () => {
  it('preserves the end trust bit for an exact same-browser baseline comparison', () => {
    const cdpBaseline = nativeImeCommitTrace(native(false));
    expect(cdpBaseline.at(-1)?.trusted).toBe(false);
    expect(nativeImeCommitTrace(native(false))).toEqual(cdpBaseline);
    expect(nativeImeCommitTrace(native(true))).not.toEqual(cdpBaseline);
  });

  it('rejects an entirely dispatchEvent-produced composition', () => {
    expect(() =>
      nativeImeCommitTrace(native(false).map((event) => ({ ...event, trusted: false })))
    ).toThrow('must be trusted');
  });

  it.each(['compositionstart', 'compositionupdate', 'beforeinput', 'input'])(
    'rejects a forged %s inside an otherwise native prefix',
    (type) => {
      const events = native(false);
      events.find((event) => event.type === type)!.trusted = false;
      expect(() => nativeImeCommitTrace(events)).toThrow('must be trusted');
    }
  );

  it('keeps partial composition incomplete until a real end is observed', () => {
    expect(() => nativeImeCommitTrace(native(false).slice(0, -1))).toThrow('incomplete');
  });

  it('rejects a nominal start/end without a native composing edit', () => {
    expect(() => nativeImeCommitTrace([native(false)[0]!, native(false).at(-1)!])).toThrow(
      'no native editing sequence'
    );
  });

  it('retains committed value and selection differences for the comparison', () => {
    const baseline = nativeImeCommitTrace(native(false));
    const wrong = native(false);
    wrong.at(-2)!.value = '中';
    wrong.at(-2)!.start = 0;
    expect(nativeImeCommitTrace(wrong)).not.toEqual(baseline);
  });
});
