import type {
  AvailableLayoutBinding,
  AvailableLayoutFrame,
  AvailableLayoutLength,
  AvailableLayoutSnapshot,
  AvailableLayoutValue,
  State,
} from '@proto.ui/core';

const units = ['logical', 'root-text', 'available', 'available-minus-root-text'];
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const ratio = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
export function isAvailableLayoutState(value: unknown): value is State<unknown> {
  return record(value) && typeof value.get === 'function';
}
const read = <T>(value: AvailableLayoutValue<T>): T =>
  isAvailableLayoutState(value) ? (value.get() as T) : value;
function validLength(value: unknown): value is AvailableLayoutLength {
  return (
    record(value) &&
    units.includes(value.unit as string) &&
    finite(value.value) &&
    value.value >= 0 &&
    (value.unit !== 'available' || value.value <= 1)
  );
}
export function validAvailableLayout(value: unknown): value is AvailableLayoutSnapshot {
  return (
    record(value) &&
    ['top', 'right', 'bottom', 'left'].includes(value.edge as string) &&
    ['intrinsic', 'fraction'].includes(value.extent as string) &&
    ratio(value.fraction) &&
    validLength(value.minimum) &&
    validLength(value.maximum) &&
    ratio(value.displacement)
  );
}
export function readAvailableLayout(
  binding: AvailableLayoutBinding,
  validateDisabled = false
): AvailableLayoutFrame {
  const value = {
    edge: read(binding.edge),
    extent: read(binding.extent),
    fraction: read(binding.fraction ?? 1),
    minimum: binding.minimum
      ? { unit: read(binding.minimum.unit), value: read(binding.minimum.value) }
      : { unit: 'logical', value: 0 },
    maximum: binding.maximum
      ? { unit: read(binding.maximum.unit), value: read(binding.maximum.value) }
      : { unit: 'available', value: 1 },
    displacement: binding.displacement ? binding.displacement.get() : 0,
  };
  const enabled = read(binding.enabled ?? true);
  if (typeof enabled !== 'boolean') return { status: 'invalid' };
  if (!enabled && !validateDisabled) return { status: 'disabled' };
  if (!validAvailableLayout(value)) return { status: 'invalid' };
  return enabled ? { status: 'ready', value } : { status: 'disabled' };
}
export function availableLayoutStates(binding: AvailableLayoutBinding): State<unknown>[] {
  const values: unknown[] = [
    binding.enabled,
    binding.edge,
    binding.extent,
    binding.fraction,
    binding.minimum?.unit,
    binding.minimum?.value,
    binding.maximum?.unit,
    binding.maximum?.value,
    binding.displacement,
  ];
  return [...new Set(values.filter(isAvailableLayoutState))];
}
function length(value: AvailableLayoutLength, available: number, rootText: number): number {
  switch (value.unit) {
    case 'logical':
      return value.value;
    case 'root-text':
      return value.value * rootText;
    case 'available':
      return value.value * available;
    case 'available-minus-root-text':
      return Math.max(0, available - value.value * rootText);
  }
}
/** Pure host-internal algebra; natural/available/rootText facts are not prototype State. */
export function resolveAvailableExtent(
  input: unknown,
  available: number,
  rootText: number,
  natural: number
) {
  if (
    !validAvailableLayout(input) ||
    !finite(available) ||
    available < 0 ||
    !finite(natural) ||
    natural < 0
  )
    return null;
  const needsRoot = [input.minimum, input.maximum].some(
    (value) => value.unit === 'root-text' || value.unit === 'available-minus-root-text'
  );
  if (needsRoot && (!finite(rootText) || rootText <= 0)) return null;
  const maximum = length(input.maximum, available, rootText);
  const requestedMinimum = length(input.minimum, available, rootText);
  if (!finite(maximum) || !finite(requestedMinimum)) return null;
  const cap = Math.max(0, Math.min(available, maximum));
  const minimum = input.extent === 'intrinsic' ? Math.min(requestedMinimum, cap) : 0;
  const extent =
    input.extent === 'intrinsic' ? Math.min(cap, Math.max(natural, minimum)) : input.fraction * cap;
  return { cap, minimum, extent };
}
