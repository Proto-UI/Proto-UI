import type { ContainingBlockLength } from '@proto.ui/core';

/** Final semantic intent, never computed CSS or a component-specific offset. */
export function matchesPresenceTopTarget(
  tokens: readonly string[],
  entered: ContainingBlockLength
): boolean {
  // These competing forms cannot establish a single unconditional top baseline.
  if (
    tokens.some(
      (token) =>
        /(?:^|:)(?:!?-?(?:top-|inset(?:-|$)|inset-y-))/.test(token) &&
        (token.includes(':') || token.includes('!') || /(?:^|:)inset/.test(token))
    )
  )
    return false;
  const top = tokens.filter((token) => /^-?top-/.test(token));
  if (top.length !== 1) return false;
  if (tokens.some((token) => /(?:^|:)(?:transition(?:-|$)|animate-)/.test(token))) return false;
  const match = top[0].match(/^(-?)top-(.+)$/)!;
  const sign = match[1] ? -1 : 1;
  const raw = match[2];
  let px = 0,
    rootText = 0,
    containingBlock = 0;
  if (/^\d+(?:\.\d+)?$/.test(raw)) rootText = Number(raw) / 4;
  else if (raw === 'px') px = 1;
  else if (raw === 'full') containingBlock = 1;
  else if (/^\d+\/\d+$/.test(raw)) {
    const [a, b] = raw.split('/').map(Number);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b === 0) return false;
    containingBlock = a / b;
  } else {
    const value = raw.match(/^\[(-?(?:\d+\.?\d*|\.\d+))(px|rem|%)\]$/);
    if (!value) return false;
    const n = Number(value[1]);
    if (value[2] === 'px') px = n;
    else if (value[2] === 'rem') rootText = n;
    else containingBlock = n / 100;
  }
  return (
    [px, rootText, containingBlock].every(Number.isFinite) &&
    entered.px === sign * px &&
    entered.rootText === sign * rootText &&
    entered.containingBlock === sign * containingBlock
  );
}

export function resolvePresenceTop(
  value: ContainingBlockLength,
  env: { containingBlockHeight?: number | null; rootFontPx: number | null }
): number | null {
  const basis = env.containingBlockHeight;
  if (
    (value.containingBlock !== 0 && (basis == null || !Number.isFinite(basis) || basis < 0)) ||
    (value.rootText !== 0 &&
      (env.rootFontPx === null || !Number.isFinite(env.rootFontPx) || env.rootFontPx < 0))
  )
    return null;
  const result =
    value.px + value.rootText * (env.rootFontPx ?? 0) + value.containingBlock * (basis ?? 0);
  return Number.isFinite(result) ? result : null;
}

/** Non-neutral opacity needs its own final semantic baseline, not a paint substitute. */
export function matchesPresenceOpacityTarget(tokens: readonly string[], entered: number): boolean {
  if (
    tokens.some(
      (token) => /(?:^|:)!?opacity-/.test(token) && (token.includes(':') || token.includes('!'))
    )
  )
    return false;
  if (tokens.some((token) => /(?:^|:)(?:transition(?:-|$)|animate-)/.test(token))) return false;
  const opacity = tokens.filter((token) => /^opacity-/.test(token));
  if (opacity.length !== 1) return false;
  const normal = opacity[0].match(/^opacity-(\d+(?:\.\d+)?)$/);
  const arbitrary = opacity[0].match(/^opacity-\[((?:\d+\.?\d*|\.\d+))\]$/);
  const value = normal ? Number(normal[1]) / 100 : arbitrary ? Number(arbitrary[1]) : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 1 && value === entered;
}
