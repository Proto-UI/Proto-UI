/**
 * Bounded logical numerical intent, independently implemented from
 * C-SLIDER-VALUE-0001-COLLISION-*; no State owner or physical input capability.
 * Source-informed behavior: Base UI v1.6.0 resolveThumbCollision and
 * getPushedThumbValues (MIT, Copyright (c) 2019 Material-UI SAS).
 * This implementation deliberately does not use their epsilon or toFixed(12),
 * and diagnoses infeasible/nonfinite/final-distance results. It does not claim
 * upstream bit equivalence. See VALUES.md for source and numerical limits.
 */
import {
  acceptValuesOwner,
  validateValuesPolicy,
  type SliderValuesFailureReason,
  type SliderValuesPolicy,
} from './values-numeric';

export type SliderValuesCollisionBehavior = 'push' | 'swap' | 'none';
export type SliderValuesCollisionFailureReason =
  | SliderValuesFailureReason
  | 'invalid-collision-behavior'
  | 'invalid-session-start'
  | 'insufficient-range';
export type SliderValuesCollisionResult =
  | { ok: true; values: number[]; index: number; didSwap: boolean }
  | { ok: false; reason: SliderValuesCollisionFailureReason };
export type SliderValuesCollisionIntent = {
  behavior: SliderValuesCollisionBehavior;
  /** Latest uncanceled proposal, or current display before the first proposal. */
  values: readonly number[];
  /** Immutable logical-session start display. Never another current owner. */
  sessionStart: readonly number[];
  index: number;
  /** Already converted/rounded numerical intent; no coordinates or host event. */
  nextValue: number;
  policy: SliderValuesPolicy;
};

const fail = (reason: SliderValuesCollisionFailureReason): SliderValuesCollisionResult => ({
  ok: false,
  reason,
});
const clamp = (value: number, low: number, high: number) => {
  const next = Math.min(Math.max(value, low), high);
  return next === 0 ? 0 : next;
};
const ordered = (values: readonly number[]) => {
  for (let i = 1; i < values.length; i++) if (values[i - 1] > values[i]) return false;
  return true;
};

/** Pure reducer. A successful result is only a proposal; callers must apply
 * veto, lifecycle, live mapping and policy validation before adopting its index.
 * No input is mutated. Own-data admission reuses the sole owner's safe copier.
 */
export function resolveValuesCollision(
  input: SliderValuesCollisionIntent
): SliderValuesCollisionResult {
  const { behavior, index, nextValue, policy } = input;
  if (behavior !== 'push' && behavior !== 'swap' && behavior !== 'none') {
    return fail('invalid-collision-behavior');
  }
  const invalid = validateValuesPolicy(policy);
  if (invalid) return invalid;
  if (!Number.isFinite(nextValue)) return fail('nonfinite-request');
  const active = acceptValuesOwner(input.values);
  if (!active.ok) return active;
  if (active.shape !== 'array') return fail('invalid-value-shape');
  const values = active.rawValues;
  if (!Number.isInteger(index) || index < 0 || index >= values.length) return fail('invalid-index');
  const start = acceptValuesOwner(input.sessionStart);
  if (!start.ok) return start;
  if (start.shape !== 'array' || start.rawValues.length !== values.length)
    return fail('invalid-session-start');
  if (!ordered(values) || !ordered(start.rawValues)) return fail('unordered-values');
  const { min, max } = policy;
  const gap = policy.step * (policy.minStepsBetweenValues ?? 0);
  const extent = max - min;
  const required = (values.length - 1) * gap;
  if (!Number.isFinite(extent) || !Number.isFinite(required)) return fail('nonfinite-intermediate');
  if (required > extent) return fail('insufficient-range');

  // Local arithmetic state is not persistent interaction or accepted-value State.
  let arithmeticFailure: SliderValuesCollisionFailureReason | null = null;
  const bound = (value: number, low: number, high: number) => {
    if (![value, low, high].every(Number.isFinite)) {
      arithmeticFailure = 'nonfinite-intermediate';
      return value;
    }
    if (low > high) {
      arithmeticFailure = 'insufficient-range';
      return value;
    }
    return clamp(value, low, high);
  };
  const reservedLow = (i: number) => min + i * gap;
  const reservedHigh = (i: number) => max - (values.length - 1 - i) * gap;
  const push = (
    candidate: number[],
    selected: number,
    request: number,
    history: readonly number[]
  ) => {
    candidate[selected] = bound(request, reservedLow(selected), reservedHigh(selected));
    for (let i = selected + 1; i < candidate.length; i++) {
      const low = candidate[i - 1] + gap;
      const restored = Math.min(candidate[i], history[i]);
      candidate[i] = bound(Math.max(restored, low), low, reservedHigh(i));
    }
    for (let i = selected - 1; i >= 0; i--) {
      const high = candidate[i + 1] - gap;
      const restored = Math.max(candidate[i], history[i]);
      candidate[i] = bound(Math.min(restored, high), reservedLow(i), high);
    }
  };
  let selected = index;
  let didSwap = false;
  if (behavior === 'push') {
    push(values, index, nextValue, [...values]);
  } else {
    const before = values[index];
    const previous = values[index - 1];
    const next = values[index + 1];
    values[index] = bound(
      nextValue,
      index > 0 ? previous + gap : min,
      index + 1 < values.length ? next - gap : max
    );
    const departing = values[index];
    const forward =
      behavior === 'swap' && nextValue > before && index + 1 < values.length && nextValue >= next;
    const backward =
      behavior === 'swap' && nextValue < before && index > 0 && nextValue <= previous;
    if (forward || backward) {
      selected = forward ? index + 1 : index - 1;
      const history = start.rawValues;
      history[index] = departing;
      const targetValue = forward
        ? Math.max(nextValue, values[selected])
        : Math.min(nextValue, values[selected]);
      push(values, selected, targetValue, history);
      const low = Math.max(index > 0 ? values[index - 1] + gap : min, reservedLow(index));
      const high = Math.min(
        index + 1 < values.length ? values[index + 1] - gap : max,
        reservedHigh(index)
      );
      values[index] = bound(departing, low, high);
      didSwap = true;
    }
  }
  if (arithmeticFailure) return fail(arithmeticFailure);
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) return fail('nonfinite-intermediate');
    if (values[i] < min || values[i] > max) return fail('invalid-bounds');
    if (i > 0) {
      const distance = values[i] - values[i - 1];
      if (!Number.isFinite(distance)) return fail('nonfinite-intermediate');
      if (distance < gap) return fail('minimum-distance');
    }
  }
  return { ok: true, values, index: selected, didSwap };
}
