/** Native computed-paint oracle. Inputs are observations, never injected styles. */
export type Rgba = readonly [number, number, number, number];
export type GhostPaint = {
  background: Rgba;
  foreground: Rgba;
  accent: Rgba;
  accentForeground: Rgba;
  normalForeground: Rgba;
  hovered: boolean;
  disabled: boolean;
  pressed: boolean;
  opacity: number;
  pointerEvents: string;
  role: string | null;
  ariaDisabled: string | null;
  tabIndex: number;
};

// Canvas normalization quantizes Chromium's lab()/oklab()/rgb() serialization
// to sRGB8. The allowance covers 8-bit conversion, not visible alpha drift.
export function sameRgba(actual: Rgba, expected: Rgba): boolean {
  if (![...actual, ...expected].every(Number.isFinite)) return false;
  return (
    Math.abs(actual[3] - expected[3]) <= 2 &&
    (expected[3] === 0 || actual.slice(0, 3).every((v, i) => Math.abs(v - expected[i]) <= 2))
  );
}

export function ghostPaintFailures(
  actual: GhostPaint,
  scheme: 'light' | 'dark',
  hovered: boolean,
  disabled = false
): string[] {
  return pinnedGhostPaintFailures(
    actual,
    scheme,
    hovered,
    disabled,
    actual.accent,
    actual.accentForeground
  );
}

/** Rhea 25af02b1: independent muted/foreground oracle, never an alternative accepted by New York. */
export function rheaGhostPaintFailures(
  actual: GhostPaint & { muted: Rgba },
  scheme: 'light' | 'dark',
  hovered: boolean,
  disabled = false
): string[] {
  return pinnedGhostPaintFailures(
    actual,
    scheme,
    hovered,
    disabled,
    actual.muted,
    actual.normalForeground
  );
}

function pinnedGhostPaintFailures(
  actual: GhostPaint,
  scheme: 'light' | 'dark',
  hovered: boolean,
  disabled: boolean,
  hoverBackground: Rgba,
  hoverForeground: Rgba
): string[] {
  const failures: string[] = [];
  const check = (ok: boolean, name: string) => {
    if (!ok) failures.push(name);
  };
  const background: Rgba =
    hovered && !disabled
      ? [
          hoverBackground[0],
          hoverBackground[1],
          hoverBackground[2],
          hoverBackground[3] * (scheme === 'dark' ? 0.5 : 1),
        ]
      : [0, 0, 0, 0];
  check(sameRgba(actual.background, background), 'background');
  check(
    sameRgba(actual.foreground, hovered && !disabled ? hoverForeground : actual.normalForeground),
    'foreground'
  );
  check(actual.hovered === (hovered && !disabled), 'hovered');
  check(actual.disabled === disabled, 'disabled');
  check(!actual.pressed, 'pressed');
  check(actual.opacity === (disabled ? 0.5 : 1), 'opacity');
  check(
    disabled ? actual.pointerEvents === 'none' : actual.pointerEvents !== 'none',
    'pointer-events'
  );
  check(actual.role === 'button', 'role');
  check(
    disabled ? actual.ariaDisabled === 'true' : actual.ariaDisabled !== 'true',
    'aria-disabled'
  );
  check(disabled ? actual.tabIndex < 0 : actual.tabIndex === 0, 'tabindex');
  return failures;
}
