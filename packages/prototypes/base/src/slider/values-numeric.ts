/**
 * NEW REBUILD CANDIDATE, 2026-10-11. Not a recovery of an old commit's bytes.
 * Independently authored, source-informed Base Slider owner/keyboard helpers.
 *
 * Raw owner values preserve scalar/array shape and array order. Display values
 * clamp a scalar or sort an array. Neither path quantizes owner values.
 * Keyboard uses min-relative Math.round plus decimal-place Number.toFixed.
 * Nonfinite intermediates and >100 decimal places are explicit diagnostics.
 * Home/End bypass rounding, retaining direct finite endpoint identity.
 * This does not import the historical decimal-grid oracle or define a generic
 * portable numeric standard. No pointer collision or cross-host claim is made.
 */
export type SliderValuesPolicy = {
  min: number;
  max: number;
  step: number;
  largeStep?: number;
  minStepsBetweenValues?: number;
};

export type SliderValuesFailureReason =
  | 'invalid-bounds'
  | 'invalid-step'
  | 'invalid-large-step'
  | 'invalid-minimum-steps'
  | 'invalid-values'
  | 'invalid-value-shape'
  | 'invalid-value-entry'
  | 'uninspectable-values'
  | 'unordered-values'
  | 'invalid-index'
  | 'nonfinite-request'
  | 'nonfinite-intermediate'
  | 'unsupported-rounding-precision'
  | 'minimum-distance';

export type SliderValuesFailure = {
  ok: false;
  reason: SliderValuesFailureReason;
};
export type SliderValuesResult = { ok: true; values: number[] } | SliderValuesFailure;
export type SliderValuesOwnerData = {
  rawValues: readonly number[];
  shape: 'scalar' | 'array';
};
export type SliderValuesOwnerAcceptance =
  | { ok: true; rawValues: number[]; shape: 'scalar' | 'array' }
  | SliderValuesFailure;
export type SliderValuesOwnerResult =
  | {
      ok: true;
      /** Finite own-data copy, original order; -0 is canonicalized to +0. */
      rawValues: number[];
      /** Independent derived display copy: scalar clamped or array sorted. */
      values: number[];
      shape: 'scalar' | 'array';
      reordered: boolean;
    }
  | SliderValuesFailure;

function failure(reason: SliderValuesFailureReason): SliderValuesFailure {
  return { ok: false, reason };
}

function positiveZero(value: number): number {
  return value === 0 ? 0 : value;
}

function bounded(value: number, min: number, max: number): number {
  return positiveZero(Math.min(Math.max(value, min), max));
}

function validBounds(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min <= max;
}

/** No ordinary index getter, inherited iterator, or caller method is read.
 * Arbitrary Proxy reflection traps are not guaranteed side-effect-free. */
function copyValues(input: unknown): SliderValuesResult {
  try {
    if (!Array.isArray(input)) return failure('invalid-values');
    const length = Object.getOwnPropertyDescriptor(input, 'length')?.value;
    if (!Number.isInteger(length) || length < 0) return failure('invalid-value-shape');
    if (Reflect.ownKeys(input).length !== length + 1) return failure('invalid-value-shape');
    const values: number[] = [];
    for (let index = 0; index < length; index += 1) {
      const entry = Object.getOwnPropertyDescriptor(input, String(index));
      if (!entry || !Object.hasOwn(entry, 'value')) return failure('invalid-value-shape');
      if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
        return failure('invalid-value-entry');
      }
      // Define an own data slot; push/assignment can invoke an inherited index setter.
      Object.defineProperty(values, String(index), {
        value: positiveZero(entry.value),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return { ok: true, values };
  } catch {
    return failure('uninspectable-values');
  }
}

export function validateValuesPolicy(policy: SliderValuesPolicy): SliderValuesFailure | null {
  if (!validBounds(policy.min, policy.max)) return failure('invalid-bounds');
  if (!Number.isFinite(policy.step) || policy.step <= 0) return failure('invalid-step');
  const largeStep = policy.largeStep ?? 10;
  if (!Number.isFinite(largeStep) || largeStep < 0) return failure('invalid-large-step');
  const minimumSteps = policy.minStepsBetweenValues ?? 0;
  if (!Number.isFinite(minimumSteps) || minimumSteps < 0) return failure('invalid-minimum-steps');
  if (!Number.isFinite(policy.step * minimumSteps)) return failure('nonfinite-intermediate');
  return null;
}

/** Data safety only: bounds or policy never block a safe creation snapshot.
 * The caller, not this pure helper, owns acceptance and persistent State. */
export function acceptValuesOwner(input: unknown): SliderValuesOwnerAcceptance {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return failure('invalid-value-entry');
    return { ok: true, rawValues: [positiveZero(input)], shape: 'scalar' };
  }
  const copied = copyValues(input);
  if (!copied.ok) return copied;
  return { ok: true, rawValues: copied.values, shape: 'array' };
}

/** Derives display from a previously accepted raw owner. The input object is
 * internal owner data, not a public coercion surface; its raw array is still
 * descriptor-validated and copied. Invalid projection leaves the owner intact. */
export function projectValuesOwner(
  owner: SliderValuesOwnerData,
  min: number,
  max: number
): SliderValuesOwnerResult {
  if (!validBounds(min, max)) return failure('invalid-bounds');
  const copied = copyValues(owner.rawValues);
  if (!copied.ok) return copied;
  if (owner.shape !== 'scalar' && owner.shape !== 'array') return failure('invalid-value-shape');
  const rawValues = copied.values;
  if (owner.shape === 'scalar') {
    if (rawValues.length !== 1) return failure('invalid-value-shape');
    return {
      ok: true,
      rawValues,
      values: [bounded(rawValues[0], min, max)],
      shape: 'scalar',
      reordered: false,
    };
  }
  const values = rawValues.slice();
  let reordered = false;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] > values[index]) reordered = true;
  }
  values.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return { ok: true, rawValues, values, shape: 'array', reordered };
}

/** Convenience only. Root should call acceptance separately when capturing
 * creation/controlled owner facts, so an invalid display policy cannot erase
 * or substitute that independently valid original input. */
export function normalizeValuesOwner(
  input: unknown,
  min: number,
  max: number
): SliderValuesOwnerResult {
  const accepted = acceptValuesOwner(input);
  return accepted.ok ? projectValuesOwner(accepted, min, max) : accepted;
}

/** Equality of resolved raw inputs, never display equivalence. Scalar vs array,
 * array order, duplicates and out-of-range finite values remain significant.
 * Invalid input returns false; ordinary getters/iterators are not evaluated. */
export function compareValuesOwnerInput(leftInput: unknown, rightInput: unknown): boolean {
  const left = acceptValuesOwner(leftInput);
  const right = acceptValuesOwner(rightInput);
  if (!left.ok || !right.ok || left.shape !== right.shape) return false;
  if (left.rawValues.length !== right.rawValues.length) return false;
  for (let index = 0; index < left.rawValues.length; index += 1) {
    if (left.rawValues[index] !== right.rawValues[index]) return false;
  }
  return true;
}

function copyRequestValues(values: readonly number[], index: number): SliderValuesResult {
  const copied = copyValues(values);
  if (!copied.ok) return copied;
  if (!Number.isInteger(index) || index < 0 || index >= copied.values.length) {
    return failure('invalid-index');
  }
  for (let slot = 1; slot < copied.values.length; slot += 1) {
    if (copied.values[slot - 1] > copied.values[slot]) return failure('unordered-values');
  }
  return copied;
}

/** Input slots are the sorted display vector, not the original-order raw owner.
 * Clamp Root first, then neighbors, then check every adjacent final distance.
 * Rejection never pushes a neighbor, changes the caller or re-quantizes a slot.
 * Out-of-bounds owner neighbors can constrain the result outside Root, retaining
 * the reference order of operations rather than silently repairing owner data. */
export function constrainValuesRequest(
  values: readonly number[],
  index: number,
  input: number,
  policy: SliderValuesPolicy
): SliderValuesResult {
  const invalidPolicy = validateValuesPolicy(policy);
  if (invalidPolicy) return invalidPolicy;
  if (!Number.isFinite(input)) return failure('nonfinite-request');
  const copied = copyRequestValues(values, index);
  if (!copied.ok) return copied;
  let next = bounded(input, policy.min, policy.max);
  if (index > 0) next = Math.max(next, copied.values[index - 1]);
  if (index + 1 < copied.values.length) next = Math.min(next, copied.values[index + 1]);
  copied.values[index] = positiveZero(next);
  const gap = policy.step * (policy.minStepsBetweenValues ?? 0);
  for (let slot = 1; slot < copied.values.length; slot += 1) {
    const distance = copied.values[slot] - copied.values[slot - 1];
    if (!Number.isFinite(distance)) return failure('nonfinite-intermediate');
    if (distance < gap) return failure('minimum-distance');
  }
  return copied;
}

function decimalPlaces(value: number): number {
  const [coefficient, exponent = '0'] = value.toString().split('e');
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
}

function recognizedKey(key: string): boolean {
  return (
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'PageUp' ||
    key === 'PageDown' ||
    key === 'Home' ||
    key === 'End'
  );
}

/** Numeric intent only. Root must subsequently call constrainValuesRequest.
 * Null without a diagnostic means an unrelated key. Unsupported arithmetic
 * emits a diagnostic instead of posing as an ordinary no-op. Alt/Ctrl/Meta
 * filtering and actual event/commit ownership remain at the Root/part layer. */
export function sliderValuesKeyboard(
  values: readonly number[],
  index: number,
  key: string,
  policy: SliderValuesPolicy,
  direction: 'ltr' | 'rtl' = 'ltr',
  shift = false,
  onDiagnostic?: (reason: SliderValuesFailureReason) => void
): number | null {
  if (!recognizedKey(key)) return null;
  const reject = (reason: SliderValuesFailureReason): null => {
    onDiagnostic?.(reason);
    return null;
  };
  const invalidPolicy = validateValuesPolicy(policy);
  if (invalidPolicy) return reject(invalidPolicy.reason);
  const copied = copyRequestValues(values, index);
  if (!copied.ok) return reject(copied.reason);
  const slots = copied.values;
  const gap = policy.step * (policy.minStepsBetweenValues ?? 0);
  if (key === 'Home' || key === 'End') {
    const candidate =
      key === 'Home'
        ? index > 0
          ? slots[index - 1] + gap
          : policy.min
        : index + 1 < slots.length
          ? slots[index + 1] - gap
          : policy.max;
    return Number.isFinite(candidate) ? positiveZero(candidate) : reject('nonfinite-intermediate');
  }

  const offset = slots[index] - policy.min;
  const units = offset / policy.step;
  const stepped = Math.round(units) * policy.step;
  const nearest = stepped + policy.min;
  if (![offset, units, stepped, nearest].every(Number.isFinite))
    return reject('nonfinite-intermediate');
  const precision = Math.max(decimalPlaces(policy.step), decimalPlaces(policy.min));
  if (precision > 100) return reject('unsupported-rounding-precision');
  const current = Number(nearest.toFixed(precision));
  const increment =
    shift || key === 'PageUp' || key === 'PageDown' ? (policy.largeStep ?? 10) : policy.step;
  const ascending =
    key === 'ArrowUp' ||
    key === 'PageUp' ||
    (key === 'ArrowRight' && direction === 'ltr') ||
    (key === 'ArrowLeft' && direction === 'rtl');
  const candidate = ascending ? current + increment : current - increment;
  if (!Number.isFinite(candidate)) return reject('nonfinite-intermediate');
  const nextPrecision = Math.max(
    decimalPlaces(current),
    decimalPlaces(increment),
    decimalPlaces(policy.min)
  );
  if (nextPrecision > 100) return reject('unsupported-rounding-precision');
  const rounded = Number(candidate.toFixed(nextPrecision));
  if (!Number.isFinite(rounded)) return reject('nonfinite-intermediate');
  return bounded(rounded, policy.min, policy.max);
}
