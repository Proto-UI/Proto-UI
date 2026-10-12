import { describe, expect, it } from 'vitest';
import {
  assertNativeTapRoute,
  assertNoAuthoredOutsideHit,
  type TapTrace,
} from './switch-native-input-evidence';

const owner = 'shadcn-switch-root#subject';
function trace(owned = true, shadow = false): TapTrace {
  const types = [
    'pointerdown',
    'touchstart',
    'pointerup',
    'touchend',
    'mousedown',
    'mouseup',
    'click',
  ];
  return {
    checkpoint: { requestedInput: { kind: 'touchscreen-tap', x: 144, y: 215.4375 }, checked: true },
    nativeEvents: types.flatMap((type, index) =>
      [1, 3].map((eventPhase) => ({
        type,
        eventId: index + 1,
        eventPhase,
        now: index * 10 + (eventPhase === 3 ? 1 : 0),
        isTrusted: true,
        defaultPrevented: false,
        composedPath: owned
          ? [
              ...(shadow ? ['div[part=surface]', '#shadow-root:' + owner] : []),
              owner,
              'main',
              'document',
              'window',
            ]
          : ['main', 'document', 'window'],
        checked: !(owned && type === 'click' && eventPhase === 3),
        clientX: index < 4 ? 144 : 151,
        clientY: index < 4 ? 215.4375 : 215,
        pointerType: 'touch',
      }))
    ),
    stateChanges: owned ? [{ prev: true, next: false, now: 60.5 }] : [],
    exposedChanges: owned ? [{ checked: false, now: 60.6 }] : [],
  };
}
const emptyOutside = () => ({
  staticHitAttribute: null as string | null,
  outsidePoints: ['left', 'right', 'top', 'bottom'].map((label) => ({ label, ownedHit: false })),
});

describe('Switch authored-hit and native-route evidence predicates', () => {
  for (const shadow of [false, true])
    it(`accepts one UA-targeted native click with ${shadow ? 'shadow' : 'document'} path`, () => {
      expect(assertNativeTapRoute(trace(true, shadow), owner, false).owned).toBe(true);
    });
  it('retains a far-touch negative with no owned click or changes', () => {
    expect(assertNativeTapRoute(trace(false), owner, true, false).owned).toBe(false);
  });
  it('rejects state changing when native click targets another element', () => {
    expect(() => assertNativeTapRoute(trace(false), owner, false)).toThrow();
  });
  it('rejects three toggles even when the terminal checked value looks correct', () => {
    const value = trace();
    value.stateChanges = [
      { prev: true, next: false, now: 60.2 },
      { prev: false, next: true, now: 60.4 },
      { prev: true, next: false, now: 60.6 },
    ];
    expect(() => assertNativeTapRoute(value, owner, false)).toThrow(/one state transition/);
  });
  it('rejects duplicate outward checkedChange and duplicate native clicks', () => {
    const signal = trace();
    signal.exposedChanges.push({ checked: false, now: 60.7 });
    expect(() => assertNativeTapRoute(signal, owner, false)).toThrow(/one checkedChange/);
    const click = trace();
    click.nativeEvents.push(...click.nativeEvents.slice(-2));
    expect(() => assertNativeTapRoute(click, owner, false)).toThrow();
  });
  it('rejects untrusted or suppressed activation and incomplete traces', () => {
    const untrusted = trace();
    untrusted.nativeEvents.at(-1)!.isTrusted = false;
    expect(() => assertNativeTapRoute(untrusted, owner, false)).toThrow(/trusted/);
    const suppressed = trace();
    suppressed.nativeEvents[0].defaultPrevented = true;
    expect(() => assertNativeTapRoute(suppressed, owner, false)).toThrow(/suppress/);
    const missing = trace();
    missing.nativeEvents.shift();
    expect(() => assertNativeTapRoute(missing, owner, false)).toThrow();
  });
  it('rejects target-domain drift or a state change before click dispatch', () => {
    const drift = trace();
    drift.nativeEvents[0].composedPath = ['main'];
    expect(() => assertNativeTapRoute(drift, owner, false)).toThrow(/owner domain/);
    const early = trace();
    early.stateChanges[0].now = 10;
    expect(() => assertNativeTapRoute(early, owner, false)).toThrow(/inside the click/);
  });
  it('accepts clean point-hit negatives, rejects an added region on each side', () => {
    expect(() => assertNoAuthoredOutsideHit(emptyOutside())).not.toThrow();
    for (let edge = 0; edge < 4; edge++) {
      const expanded = emptyOutside();
      expanded.outsidePoints[edge].ownedHit = true;
      expect(() => assertNoAuthoredOutsideHit(expanded)).toThrow(/extends outside/);
    }
  });
  it('rejects an inset declaration even when point probes happen to miss it', () => {
    const declared = emptyOutside();
    declared.staticHitAttribute = 'unexpected';
    expect(() => assertNoAuthoredOutsideHit(declared)).toThrow(/static hit inset/);
  });
});
