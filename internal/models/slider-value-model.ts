/**
 * Executable draft mathematics for C-SLIDER-VALUE-0001; not a runtime owner.
 * Decimal integer arithmetic is an internal, bounded test oracle. No component
 * imports this file, and no BigInt enters its JSON-compatible results.
 */
import { clamp, percentage } from '../../packages/prototypes/base/src/progress/range';

export type SliderModelOptions = {
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minStepsBetweenValues?: number;
  thumbCollisionBehavior?: 'push' | 'swap' | 'none';
};
export type SliderModel = Readonly<{
  shape: 'scalar' | 'array';
  values: readonly number[];
  min: number;
  max: number;
  step: number;
  largeStep: number;
  minStepsBetweenValues: number;
  thumbCollisionBehavior: 'push' | 'swap' | 'none';
}>;
export type SliderProposal = Readonly<{
  model: SliderModel;
  activeIndex: number;
  changed: boolean;
  swapped: boolean;
  /** A rejected/unsupported request is not disguised as an ordinary no-change result. */
  diagnostic: string | null;
}>;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
class OracleDiagnostic extends Error {}
const fail = (reason: string): never => {
  throw new OracleDiagnostic(reason);
};

// Finite Number.toString() inputs have at most 17 significant digits and decimal
// exponents in [-324, 308]. Intermediates are separately bounded; this oracle is
// not an arbitrary precision public API or a promise about any Compiler/host.
// span < 3.6e308 and step >= 5e-324 under shortest-decimal interpretation:
// last grid index < 7.2e631 < 2^2100, hence at most 2101 bisections suffice.
// The fixed 4096 iteration guard exceeds that proven bound; it is not a timeout.
const MAX_POWER = 1024,
  MAX_DIGITS = 2048,
  MAX_SEARCH = 4096;
type Decimal = Readonly<{ n: bigint; e: number }>;
function decimal(n: bigint, e: number): Decimal {
  if (!Number.isInteger(e) || Math.abs(e) > MAX_POWER || n.toString().length > MAX_DIGITS)
    return fail('oracle-precision-budget');
  if (n === 0n) return { n: 0n, e: 0 };
  while (n % 10n === 0n) {
    n /= 10n;
    e++;
  }
  if (Math.abs(e) > MAX_POWER) return fail('oracle-precision-budget');
  return { n, e };
}
function dec(v: number): Decimal {
  if (!finite(v)) return fail('invalid-number');
  const [mantissa, exponent = '0'] = v.toString().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return decimal(BigInt(mantissa.replace('.', '')), Number(exponent) - fraction);
}
function power(n: number): bigint {
  if (!Number.isInteger(n) || n < 0 || n > MAX_POWER) return fail('oracle-precision-budget');
  return 10n ** BigInt(n);
}
function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const e = Math.min(a.e, b.e);
  const x = a.n * power(a.e - e),
    y = b.n * power(b.e - e);
  if (x.toString().length > MAX_DIGITS || y.toString().length > MAX_DIGITS)
    return fail('oracle-precision-budget');
  return [x, y, e];
}
function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, e] = align(a, b);
  return decimal(x + y, e);
}
function sub(a: Decimal, b: Decimal): Decimal {
  return add(a, { n: -b.n, e: b.e });
}
function mul(a: Decimal, b: Decimal): Decimal {
  return decimal(a.n * b.n, a.e + b.e);
}
function cmp(a: Decimal, b: Decimal): number {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}
function floorRatio(a: Decimal, b: Decimal): bigint {
  const [x, y] = align(a, b);
  if (y <= 0n) return fail('invalid-step');
  const q = x / y;
  return x < 0n && x % y !== 0n ? q - 1n : q;
}
function numberOf(v: Decimal): number {
  const next = Number(`${v.n}e${v.e}`);
  if (!finite(next)) return fail('unrepresentable-grid-value');
  return Object.is(next, -0) ? 0 : next;
}
const gap = (m: SliderModel) => mul(dec(m.step), dec(m.minStepsBetweenValues));
const equal = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const validIndex = (m: SliderModel, i: number) =>
  Number.isInteger(i) && i >= 0 && i < m.values.length;
function vector(v: unknown): v is readonly number[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i) || !finite(v[i])) return false;
  return true;
}
function withValues(m: SliderModel, values: readonly number[]): SliderModel {
  return Object.freeze({ ...m, values: Object.freeze([...values]) });
}
function point(m: SliderModel, k: bigint): Decimal {
  return add(dec(m.min), mul(dec(m.step), decimal(k, 0)));
}
function onGrid(m: SliderModel, v: number): boolean {
  return finite(v) && v >= m.min && v <= m.max && nearest(m, dec(v)) === v;
}
/**
 * Inclusive bounds in the actual Number-projected domain, not the ideal decimal
 * grid. The projection is monotone but can map many indices to the same Number.
 * Binary search preserves those plateaus in either direction without epsilon.
 */
function allowedBound(m: SliderModel, v: Decimal, upward: boolean): number {
  const min = dec(m.min),
    max = dec(m.max);
  if (upward) {
    if (cmp(v, max) > 0) return fail('infeasible-grid-spacing');
    if (cmp(v, min) <= 0) return m.min;
  } else {
    if (cmp(v, min) < 0) return fail('infeasible-grid-spacing');
    if (cmp(v, max) >= 0) return m.max;
  }
  const last = floorRatio(sub(max, min), dec(m.step));
  let low = 0n,
    high = last + 1n,
    iterations = 0;
  // high may be a sentinel after the final ideal grid index; it is never read.
  // Find first projection >= v (ceil) or > v (floor), including duplicate values.
  while (low < high) {
    if (++iterations > MAX_SEARCH) return fail('oracle-search-budget');
    const middle = (low + high) / 2n,
      comparison = cmp(dec(numberOf(point(m, middle))), v);
    if (upward ? comparison >= 0 : comparison > 0) high = middle;
    else low = middle + 1n;
  }
  if (upward) return low > last ? m.max : numberOf(point(m, low));
  return numberOf(point(m, low - 1n));
}
const ceilAllowed = (m: SliderModel, v: Decimal) => allowedBound(m, v, true);
const floorAllowed = (m: SliderModel, v: Decimal) => allowedBound(m, v, false);
/** Closest member of the feasible lattice plus exact endpoints, with upward ties. */
function nearest(m: SliderModel, v: Decimal, low = m.min, high = m.max): number {
  if (low > high) return fail('infeasible-grid-spacing');
  if (cmp(v, dec(low)) <= 0) return low;
  if (cmp(v, dec(high)) >= 0) return high;
  const below = Math.max(low, floorAllowed(m, v)),
    above = Math.min(high, ceilAllowed(m, v));
  return cmp(sub(v, dec(below)), sub(dec(above), v)) < 0 ? below : above;
}
function checkValues(m: SliderModel, values: readonly number[]): void {
  if (!vector(values) || values.some((v) => !onGrid(m, v))) return fail('invalid-grid-value');
  for (let i = 1; i < values.length; i++)
    if (cmp(sub(dec(values[i]), dec(values[i - 1])), gap(m)) < 0)
      return fail('invalid-owner-spacing');
}
function slotEdges(m: SliderModel): { lower: number[]; upper: number[] } {
  const lower = [m.min],
    upper = new Array<number>(m.values.length),
    g = gap(m);
  upper[m.values.length - 1] = m.max;
  for (let i = 1; i < m.values.length; i++) lower[i] = ceilAllowed(m, add(dec(lower[i - 1]), g));
  for (let i = m.values.length - 2; i >= 0; i--)
    upper[i] = floorAllowed(m, sub(dec(upper[i + 1]), g));
  return { lower, upper };
}
function boundsFor(
  m: SliderModel,
  values: readonly number[],
  index: number
): { min: number; max: number } {
  return {
    min: index === 0 ? m.min : ceilAllowed(m, add(dec(values[index - 1]), gap(m))),
    max: index === values.length - 1 ? m.max : floorAllowed(m, sub(dec(values[index + 1]), gap(m))),
  };
}

/** Shape normalization is explicit and cannot silently rewrite the owner's array. */
export function prepareSliderModel(
  input: unknown,
  options: SliderModelOptions = {}
):
  | {
      ok: true;
      model: SliderModel;
      normalization: Readonly<{ reordered: boolean; sourceIndices: readonly number[] }>;
    }
  | { ok: false; reason: string } {
  const {
    min = 0,
    max = 100,
    step = 1,
    largeStep = 10,
    minStepsBetweenValues = 0,
    thumbCollisionBehavior = 'push',
  } = options;
  if (
    ![min, max, step, largeStep, minStepsBetweenValues].every(finite) ||
    max < min ||
    step <= 0 ||
    largeStep <= 0 ||
    !Number.isInteger(minStepsBetweenValues) ||
    minStepsBetweenValues < 0 ||
    !['push', 'swap', 'none'].includes(thumbCollisionBehavior)
  )
    return { ok: false, reason: 'invalid-policy' };
  if (!finite(input) && !vector(input)) return { ok: false, reason: 'invalid-value' };
  try {
    const m: SliderModel = {
      shape: finite(input) ? 'scalar' : 'array',
      values: [],
      min: min === 0 ? 0 : min,
      max: max === 0 ? 0 : max,
      step,
      largeStep,
      minStepsBetweenValues,
      thumbCollisionBehavior,
    };
    const entries = (finite(input) ? [input] : [...input])
      .map((v, sourceIndex) => ({ value: nearest(m, dec(v)), sourceIndex }))
      .sort((a, b) =>
        a.value < b.value ? -1 : a.value > b.value ? 1 : a.sourceIndex - b.sourceIndex
      );
    const result = withValues(
      m,
      entries.map((v) => v.value)
    );
    slotEdges(result);
    checkValues(result, result.values);
    const sourceIndices = Object.freeze(entries.map((v) => v.sourceIndex));
    return {
      ok: true,
      model: result,
      normalization: Object.freeze({
        reordered: sourceIndices.some((v, i) => v !== i),
        sourceIndices,
      }),
    };
  } catch (e) {
    if (e instanceof OracleDiagnostic) return { ok: false, reason: e.message };
    throw e;
  }
}

/** Numeric keyboard/ARIA limits are legal values, not off-grid gap boundaries. */
export function sliderThumbBounds(
  m: SliderModel,
  index: number
): { min: number; max: number } | null {
  if (!validIndex(m, index)) return null;
  return boundsFor(m, m.values, index);
}
function pushed(
  m: SliderModel,
  values: readonly number[],
  index: number,
  target: number,
  baseline = values
): number[] {
  const out = [...values],
    { lower, upper } = slotEdges(m),
    g = gap(m);
  out[index] = nearest(m, dec(target), lower[index], upper[index]);
  for (let i = index + 1; i < out.length; i++) {
    const low = ceilAllowed(m, add(dec(out[i - 1]), g));
    out[i] = nearest(m, dec(Math.max(baseline[i], low)), low, upper[i]);
  }
  for (let i = index - 1; i >= 0; i--) {
    const high = floorAllowed(m, sub(dec(out[i + 1]), g));
    out[i] = nearest(m, dec(Math.min(baseline[i], high)), lower[i], high);
  }
  return out;
}

/** Data-only proposal. No value, identity or focus is accepted by calling this function. */
export function proposeSliderValue(
  m: SliderModel,
  index: number,
  input: number,
  source: 'pointer' | 'keyboard',
  initialValues: readonly number[] = m.values
): SliderProposal {
  const unchanged = (diagnostic: string | null = null): SliderProposal => ({
    model: m,
    activeIndex: index,
    changed: false,
    swapped: false,
    diagnostic,
  });
  if (!validIndex(m, index)) return unchanged('invalid-index');
  if (!finite(input)) return unchanged('invalid-request');
  try {
    checkValues(m, m.values);
    const target = nearest(m, dec(input)),
      current = m.values[index];
    let values = [...m.values],
      activeIndex = index;
    const collision = source === 'keyboard' ? 'none' : m.thumbCollisionBehavior;
    if (collision === 'push') values = pushed(m, values, index, target);
    else {
      const bounds = boundsFor(m, values, index);
      values[index] = nearest(m, dec(target), bounds.min, bounds.max);
      if (collision === 'swap') {
        if (!vector(initialValues) || initialValues.length !== values.length)
          return unchanged('invalid-snapshot');
        checkValues(m, initialValues);
        const forward =
          target > current && index + 1 < values.length && target >= m.values[index + 1];
        const backward = target < current && index > 0 && target <= m.values[index - 1];
        if (forward || backward) {
          activeIndex += forward ? 1 : -1;
          const former = values[index],
            baseline = initialValues.map((v, i) => (i === index ? former : v));
          values = pushed(
            m,
            values,
            activeIndex,
            forward ? Math.max(target, values[activeIndex]) : Math.min(target, values[activeIndex]),
            baseline
          );
          const updated = boundsFor(m, values, index),
            edges = slotEdges(m);
          values[index] = nearest(
            m,
            dec(former),
            Math.max(updated.min, edges.lower[index]),
            Math.min(updated.max, edges.upper[index])
          );
        }
      }
    }
    // An implementation invariant violation must not silently turn into a no-op.
    checkValues(m, values);
    const changed = !equal(values, m.values);
    return {
      model: changed ? withValues(m, values) : m,
      activeIndex: changed ? activeIndex : index,
      changed,
      swapped: changed && activeIndex !== index,
      diagnostic: null,
    };
  } catch (e) {
    if (e instanceof OracleDiagnostic) return unchanged(e.message);
    throw e;
  }
}

/** Center-aligned normalized coordinates only; edge geometry is separately blocked. */
export function closestSliderThumb(
  m: SliderModel,
  position: number,
  disabledIndices: readonly number[] = [],
  originIndex?: number
): number {
  if (!finite(position)) return -1;
  const enabled = (i: number) => validIndex(m, i) && !disabledIndices.includes(i);
  if (originIndex !== undefined && enabled(originIndex)) {
    if (m.values[originIndex] === m.max) {
      for (let i = 0; i <= originIndex; i++) if (m.values[i] === m.max && enabled(i)) return i;
    }
    return originIndex;
  }
  let best = -1,
    distance = Infinity;
  for (let i = 0; i < m.values.length; i++) {
    if (!enabled(i)) continue;
    const next = Math.abs(percentage(m.values[i], m.min, m.max) - clamp(position, 0, 1) * 100);
    if (next <= distance) {
      best = i;
      distance = next;
    }
  }
  return best;
}

export function sliderIndicatorInterval(
  m: SliderModel,
  startIndex?: number,
  endIndex?: number
): { start: number; end: number; size: number } | null {
  const explicit = startIndex !== undefined || endIndex !== undefined;
  if (
    explicit &&
    (startIndex === undefined ||
      endIndex === undefined ||
      !validIndex(m, startIndex) ||
      !validIndex(m, endIndex) ||
      startIndex > endIndex)
  )
    return null;
  const start = explicit
    ? percentage(m.values[startIndex!], m.min, m.max)
    : m.values.length > 1
      ? percentage(m.values[0], m.min, m.max)
      : 0;
  const end = percentage(m.values[explicit ? endIndex! : m.values.length - 1], m.min, m.max);
  return { start, end, size: end - start };
}

export function sliderKeyboardValue(
  m: SliderModel,
  index: number,
  key: string,
  options: {
    direction?: 'ltr' | 'rtl';
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
  } = {}
): number | null {
  const bounds = sliderThumbBounds(m, index);
  if (!bounds || options.altKey || options.ctrlKey || options.metaKey) return null;
  if (key === 'Home') return bounds.min;
  if (key === 'End') return bounds.max;
  const right = options.direction === 'rtl' ? -1 : 1;
  const direction =
    key === 'ArrowUp' || key === 'PageUp'
      ? 1
      : key === 'ArrowDown' || key === 'PageDown'
        ? -1
        : key === 'ArrowRight'
          ? right
          : key === 'ArrowLeft'
            ? -right
            : 0;
  if (!direction) return null;
  const amount = options.shiftKey || key.startsWith('Page') ? m.largeStep : m.step;
  return nearest(
    m,
    add(dec(m.values[index]), mul(dec(amount), dec(direction))),
    bounds.min,
    bounds.max
  );
}

/** An eligibility predicate, not a runtime acknowledgement or commit implementation. */
export function sliderCommitChanged(
  start: SliderModel,
  current: SliderModel,
  result: { accepted: boolean; canceled: boolean }
): boolean {
  return (
    result.accepted &&
    !result.canceled &&
    start.shape === current.shape &&
    start.values.length === current.values.length &&
    !equal(start.values, current.values)
  );
}

/** Physical-to-logical reference only. Track already receives AxisInput's logical position. */
export function sliderAxisPosition(
  physical: number,
  orientation: 'horizontal' | 'vertical',
  direction: 'ltr' | 'rtl'
): number | null {
  if (!finite(physical)) return null;
  const p = clamp(physical, 0, 1);
  return orientation === 'vertical' || direction === 'rtl' ? 1 - p : p;
}

/** Finite convex interpolation; no host rectangles or reversed vector order. */
export function sliderValueAtPosition(m: SliderModel, position: number): number | null {
  if (!finite(position)) return null;
  const p = clamp(position, 0, 1),
    span = m.max - m.min;
  return Number.isFinite(span) ? m.min + p * span : m.min * (1 - p) + m.max * p;
}

/**
 * Center-aligned grab-origin reference. AxisInput positions/deltas are already
 * logical and direction-adjusted. Track press seeks; Thumb press retains its
 * accepted start value and applies totalDelta, preserving an off-center grab.
 * The caller must still enforce session identity/cancellation and owner receipt.
 */
export function sliderPointerValue(
  m: SliderModel,
  origin: { kind: 'track' } | { kind: 'thumb'; startValue: number },
  sample: { phase: 'start' | 'move' | 'end'; position: number; totalDelta: number }
): number | null {
  if (!finite(sample.position) || !finite(sample.totalDelta)) return null;
  if (origin.kind === 'track') return sliderValueAtPosition(m, sample.position);
  if (!onGrid(m, origin.startValue)) return null;
  if (sample.phase === 'start' || sample.totalDelta === 0) return origin.startValue;
  return sliderValueAtPosition(
    m,
    percentage(origin.startValue, m.min, m.max) / 100 + sample.totalDelta
  );
}
