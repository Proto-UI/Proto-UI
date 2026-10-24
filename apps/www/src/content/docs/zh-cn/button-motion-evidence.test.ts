import { describe, expect, it } from 'vitest';
import {
  BUTTON_SHADOW_PATTERN,
  buttonMotionIssues,
  type ButtonMotionFrame,
} from './button-motion-evidence';

function trace(
  distance: number,
  direction: 'enter' | 'release',
  reduced = false
): ButtonMotionFrame[] {
  const fractions = reduced ? [0, 0, 1, 1, 1] : [0, 0.23658736, 0.77556131, 0.95936774, 1];
  return fractions.map((progress, index) => {
    const painted = direction === 'enter' ? progress : 1 - progress;
    return {
      time: index * 37.5,
      connected: true,
      x: painted * distance,
      y: painted * distance,
      shadow: 'fixture',
      shadowX: 4 * (1 - painted),
      shadowY: 4 * (1 - painted),
      shadowAlpha: 1 - painted,
      shadowBlur: 0,
      shadowSpread: 0,
      property: reduced ? 'none' : 'all',
      duration: reduced ? '0s' : '0.15s',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transformTime: reduced || index === 0 || index === 4 ? null : index * 37.5,
      shadowTime: reduced || index === 0 || index === 4 ? null : index * 37.5,
      pressed: direction === 'enter',
    };
  });
}

describe('real motion evidence contract (synthetic negative controls, not browser evidence)', () => {
  it.each([4, 8])(
    'accepts declared curves in both directions with %ipx translation and fixed 4px shadow',
    (distance) => {
      for (const direction of ['enter', 'release'] as const)
        expect(buttonMotionIssues(trace(distance, direction), direction, distance, false)).toEqual(
          []
        );
    }
  );
  it('rejects endpoint-only snaps and transform-only partial alignment', () => {
    expect(
      buttonMotionIssues(
        trace(4, 'enter', true).map((frame) => ({ ...frame, property: 'all', duration: '0.15s' })),
        'enter',
        4,
        false
      )
    ).toContain('missing transform intermediate frames');
    const frames = trace(4, 'enter').map((frame, index) => ({
      ...frame,
      shadowX: index ? 0 : 4,
      shadowY: index ? 0 : 4,
      shadowAlpha: index ? 0 : 1,
    }));
    expect(buttonMotionIssues(frames, 'enter', 4, false)).toContain(
      'missing shadow intermediate frames'
    );
  });
  it('rejects linear sampled values even if the CSS timing label claims a cubic curve', () => {
    const frames = trace(4, 'enter').map((frame, index) => ({
      ...frame,
      x: index,
      y: index,
      shadowX: 4 - index,
      shadowY: 4 - index,
      shadowAlpha: 1 - index / 4,
    }));
    expect(buttonMotionIssues(frames, 'enter', 4, false)).toContain(
      'transform differs from declared easing'
    );
    expect(buttonMotionIssues(frames, 'enter', 4, false)).toContain(
      'shadow differs from declared easing'
    );
  });
  it('requires static endpoints and no timing writer under live reduced motion', () => {
    expect(buttonMotionIssues(trace(8, 'release', true), 'release', 8, true)).toEqual([]);
    expect(buttonMotionIssues(trace(8, 'release'), 'release', 8, true)).toContain(
      'reduced motion interpolates'
    );
    expect(buttonMotionIssues(trace(8, 'release'), 'release', 8, true)).toContain(
      'reduced motion has an active timing writer'
    );
  });
  it('rejects timing changes and a replacement subject', () => {
    const frames = trace(4, 'enter').map((frame) => ({
      ...frame,
      duration: '0.24s',
      connected: false,
    }));
    expect(buttonMotionIssues(frames, 'enter', 4, false)).toContain(
      'incorrect CSS timing contract'
    );
    expect(buttonMotionIssues(frames, 'enter', 4, false)).toContain(
      'subject replaced during motion'
    );
  });
  it('rejects a blurred or spread shadow even when the timing curve matches', () => {
    for (const property of ['shadowBlur', 'shadowSpread'] as const) {
      const altered = trace(4, 'enter').map((frame) => ({ ...frame, [property]: 1 }));
      expect(buttonMotionIssues(altered, 'enter', 4, false)).toContain(
        'shadow is not the hard zero-blur/zero-spread family paint'
      );
    }
  });
});

// Same anchored pattern is passed into the real browser sampler, not a second
// permissive parser used only by the synthetic controls.
it.each(['5.33397e-08', '1.7124e-07', '3.70407e-08', '.5', '-1.2E+2', '+0'])(
  'preserves valid CSS numeric serialization %s',
  (number) => {
    const match = `rgba(0, 0, 0, 0) ${number}px ${number}px 0px 0px`.match(
      new RegExp(BUTTON_SHADOW_PATTERN)
    );
    expect(match).not.toBeNull();
    expect(Number(match![2])).toBe(Number(number));
    expect(Number(match![3])).toBe(Number(number));
  }
);
it.each([
  'NaN',
  'Infinity',
  '-Infinity',
  '1e',
  '1e--2',
  '1..2',
  '--1',
  '.',
  '1.',
  '0em',
  'calc(1 + 2)',
])('rejects invalid CSS numeric serialization %s', (number) => {
  expect(
    `rgba(0, 0, 0, 0) ${number}px 0px 0px 0px`.match(new RegExp(BUTTON_SHADOW_PATTERN))
  ).toBeNull();
});
it.each([
  'inset rgb(0, 0, 0) 0px 0px 0px 0px',
  'rgb(NaN, 0, 0) 0px 0px 0px 0px',
  'rgb(0, 0) 0px 0px 0px 0px',
  'rgb(0, 0, 0) 0px 0px 0px',
  'rgb(0, 0, 0) 0px 0px 0px 0px junk',
])('rejects unknown shadow structure %s', (shadow) => {
  expect(shadow.match(new RegExp(BUTTON_SHADOW_PATTERN))).toBeNull();
});
it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number('1e309')])(
  'rejects non-finite sample %s rather than accepting an endpoint',
  (value) => {
    for (const property of [
      'time',
      'x',
      'y',
      'shadowX',
      'shadowY',
      'shadowBlur',
      'shadowSpread',
      'shadowAlpha',
      'transformTime',
      'shadowTime',
    ] as const) {
      const frames = trace(4, 'enter').map((frame, index) =>
        index === 2 ? { ...frame, [property]: value } : frame
      );
      expect(buttonMotionIssues(frames, 'enter', 4, false)).toEqual([
        'non-finite motion observation',
      ]);
    }
  }
);
