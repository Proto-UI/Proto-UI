import { expect, it } from 'vitest';
import { ghostPaintFailures, sameRgba, type GhostPaint } from './ghost-paint-oracle';
const observation = (scheme: 'light' | 'dark', hovered: boolean, disabled = false): GhostPaint => ({
  background: hovered && !disabled ? [65, 65, 65, scheme === 'dark' ? 128 : 255] : [0, 0, 0, 0],
  foreground: hovered && !disabled ? [245, 245, 245, 255] : [250, 250, 250, 255],
  accent: [65, 65, 65, 255],
  accentForeground: [245, 245, 245, 255],
  normalForeground: [250, 250, 250, 255],
  hovered: hovered && !disabled,
  disabled,
  pressed: false,
  opacity: disabled ? 0.5 : 1,
  pointerEvents: disabled ? 'none' : 'auto',
  role: 'button',
  ariaDisabled: disabled ? 'true' : null,
  tabIndex: disabled ? -1 : 0,
});
it.each(['light', 'dark'] as const)(
  'accepts %s hover/leave and disabled endpoint observations',
  (scheme) => {
    for (const [hovered, disabled] of [
      [false, false],
      [true, false],
      [false, true],
    ] as const)
      expect(
        ghostPaintFailures(observation(scheme, hovered, disabled), scheme, hovered, disabled)
      ).toEqual([]);
  }
);
it('rejects the old opaque dark ghost and missing generated paint', () => {
  const actual = observation('dark', true);
  expect(ghostPaintFailures({ ...actual, background: [65, 65, 65, 255] }, 'dark', true)).toContain(
    'background'
  );
  expect(ghostPaintFailures({ ...actual, background: [0, 0, 0, 0] }, 'dark', true)).toContain(
    'background'
  );
  expect(
    ghostPaintFailures({ ...actual, foreground: actual.normalForeground }, 'dark', true)
  ).toContain('foreground');
});
it('rejects retained hover after leave and disabled interaction leakage', () => {
  expect(ghostPaintFailures(observation('light', true), 'light', false)).toContain('hovered');
  expect(
    ghostPaintFailures(
      {
        ...observation('dark', false, true),
        hovered: true,
        pressed: true,
        pointerEvents: 'auto',
        tabIndex: 0,
      },
      'dark',
      false,
      true
    )
  ).toEqual(expect.arrayContaining(['hovered', 'pressed', 'pointer-events', 'tabindex']));
});
it('allows only conversion rounding and never accepts invalid or materially different alpha', () => {
  expect(sameRgba([65, 65, 65, 128], [65, 65, 65, 127.5])).toBe(true);
  expect(sameRgba([65, 65, 65, 255], [65, 65, 65, 127.5])).toBe(false);
  expect(sameRgba([NaN, 0, 0, 0], [0, 0, 0, 0])).toBe(false);
});
