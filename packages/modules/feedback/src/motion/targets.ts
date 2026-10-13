import { getSemanticGroupKeyV0, type ResidentMotionProperty } from '@proto.ui/core';
export type MotionLength = Readonly<{ px: number; rem: number; percent: number }>;
export type MotionTranslate = Readonly<{ x: MotionLength; y: MotionLength }>;
export type MotionColor = Readonly<{ role: string; alpha: number }>;
const zero = (): MotionLength => Object.freeze({ px: 0, rem: 0, percent: 0 });
function length(raw: string, negative: boolean): MotionLength | null {
  let result: MotionLength | null = null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) result = { px: 0, rem: Number(raw) / 4, percent: 0 };
  else if (/^\d+\/\d+$/.test(raw)) {
    const [numerator, denominator] = raw.split('/').map(Number);
    if (Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator) && denominator > 0)
      result = { px: 0, rem: 0, percent: (100 * numerator) / denominator };
  } else if (raw === 'full') result = { px: 0, rem: 0, percent: 100 };
  else if (/^\[calc\(/.test(raw)) {
    const calc = raw
      .replaceAll('_', '')
      .match(/^\[calc\((-?\d+(?:\.\d+)?)%([+-])(\d+(?:\.\d+)?)(px|rem)\)\]$/);
    if (calc) {
      const offset = Number(calc[3]) * (calc[2] === '-' ? -1 : 1);
      result = {
        percent: Number(calc[1]),
        px: calc[4] === 'px' ? offset : 0,
        rem: calc[4] === 'rem' ? offset : 0,
      };
    }
  } else {
    const m = raw.match(/^\[(-?\d+(?:\.\d+)?)(px|rem|%)\]$/);
    if (m)
      result = {
        px: m[2] === 'px' ? Number(m[1]) : 0,
        rem: m[2] === 'rem' ? Number(m[1]) : 0,
        percent: m[2] === '%' ? Number(m[1]) : 0,
      };
  }
  return (
    result &&
    Object.freeze(
      negative ? { px: -result.px, rem: -result.rem, percent: -result.percent } : result
    )
  );
}
/** Split only top-level variant separators; arbitrary selectors/values may contain colons. */
function utility(token: string): { value: string; scoped: boolean } {
  let square = 0,
    round = 0,
    start = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '[') square++;
    else if (c === ']') square--;
    else if (c === '(') round++;
    else if (c === ')') round--;
    else if (c === ':' && square === 0 && round === 0) start = i + 1;
  }
  return { value: token.slice(start).replace(/^!|!$/g, ''), scoped: start > 0 };
}
/** Consumes final semantic tokens, never lowered host selectors or CSS strings. */
export function extractResidentMotionTarget(
  tokens: readonly string[],
  property: ResidentMotionProperty
):
  | { supported: true; value: MotionTranslate | MotionColor; ownedTokens: readonly string[] }
  | { supported: false; reason: string } {
  const relevant = (t: string) =>
    property === 'translate' ? /^-?translate-[xy]-/.test(t) : getSemanticGroupKeyV0(t) === 'bg-';
  const utilities = tokens.map(utility);
  if (utilities.some((t) => t.scoped && relevant(t.value)))
    return { supported: false, reason: 'selector-dependent-target' };
  if (utilities.some((t) => /^(transition($|-)|animate-)/.test(t.value)))
    return { supported: false, reason: 'competing-timing-writer' };
  const owned = tokens.filter(relevant);
  if (property === 'translate') {
    if (utilities.some((t) => /^-?(transform|rotate-|scale-|skew-|perspective-)/.test(t.value)))
      return { supported: false, reason: 'transform-composition-unavailable' };
    let x = zero(),
      y = zero();
    const seen = new Set<string>();
    for (const token of owned) {
      const m = token.match(/^(-?)translate-([xy])-(.+)$/)!;
      if (seen.has(m[2])) return { supported: false, reason: 'ambiguous-target' };
      seen.add(m[2]);
      const v = length(m[3], m[1] === '-');
      if (!v) return { supported: false, reason: 'length-unavailable' };
      if (m[2] === 'x') x = v;
      else y = v;
    }
    if (!owned.length) return { supported: false, reason: 'missing-target' };
    return { supported: true, value: Object.freeze({ x, y }), ownedTokens: Object.freeze(owned) };
  }
  if (owned.length !== 1) return { supported: false, reason: 'missing-or-ambiguous-target' };
  const m = owned[0].match(/^bg-([a-z][a-z0-9-]*)(?:\/(\d+(?:\.\d+)?))?$/);
  if (!m || (m[2] !== undefined && Number(m[2]) > 100))
    return { supported: false, reason: 'color-unavailable' };
  return {
    supported: true,
    value: Object.freeze({ role: m[1], alpha: m[2] === undefined ? 1 : Number(m[2]) / 100 }),
    ownedTokens: Object.freeze(owned),
  };
}
export function resolveMotionTranslate(
  value: MotionTranslate,
  basis: { rootFontPx: number | null; width: number | null; height: number | null }
): readonly number[] | null {
  const axis = (v: MotionLength, size: number | null) => {
    if (
      (v.rem &&
        (basis.rootFontPx === null ||
          !Number.isFinite(basis.rootFontPx) ||
          basis.rootFontPx < 0)) ||
      (v.percent && (size === null || !Number.isFinite(size) || size < 0))
    )
      return null;
    const result = v.px + v.rem * (basis.rootFontPx ?? 0) + (v.percent * (size ?? 0)) / 100;
    return Number.isFinite(result) ? result : null;
  };
  const x = axis(value.x, basis.width),
    y = axis(value.y, basis.height);
  return x === null || y === null ? null : Object.freeze([x, y]);
}
