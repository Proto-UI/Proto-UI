import type { AvailableLayoutLength } from '@proto.ui/core';

type Ready = {
  status: 'ready';
  mode: 'intrinsic' | 'fraction';
  points: number[];
  controlled: boolean;
  selection: number | null;
  minimum: AvailableLayoutLength;
  maximum: AvailableLayoutLength;
};
type Invalid = {
  status: 'invalid';
  reason: 'snap-points' | 'snap-selection' | 'minimum' | 'maximum';
};
const absent = (value: unknown) => value === undefined || value === null;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
function length(value: unknown): AvailableLayoutLength | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const unit = record.unit;
  const coefficient = record.value;
  if (
    !['logical', 'root-text', 'available', 'available-minus-root-text'].includes(unit as string) ||
    !finite(coefficient) ||
    coefficient < 0 ||
    (unit === 'available' && coefficient > 1)
  )
    return null;
  return { unit: unit as AvailableLayoutLength['unit'], value: coefficient };
}
/** Pure draft model; live consumer admission and host geometry are verified separately. */
export function drawerExtentModel(
  raw: Readonly<Record<string, unknown>>,
  defaultMaximum: AvailableLayoutLength = { unit: 'available', value: 1 }
): Ready | Invalid {
  const { snapPoints: input, side, minExtent, maxExtent, snapPoint, defaultSnapPoint } = raw;
  if (!absent(input) && !Array.isArray(input)) return { status: 'invalid', reason: 'snap-points' };
  const snapshot = Array.isArray(input) ? Array.from(input) : [];
  if (snapshot.some((point) => !finite(point) || point <= 0 || point > 1))
    return { status: 'invalid', reason: 'snap-points' };
  const points = [...new Set(snapshot as number[])].sort((a, b) => a - b);
  const horizontal = side === 'left' || side === 'right';
  const mode = horizontal || points.length > 0 ? 'fraction' : 'intrinsic';
  if (horizontal && points.length === 0) points.push(1);
  const minimum = length(absent(minExtent) ? { unit: 'logical', value: 0 } : minExtent);
  const maximum = length(absent(maxExtent) ? defaultMaximum : maxExtent);
  if (!minimum) return { status: 'invalid', reason: 'minimum' };
  if (!maximum) return { status: 'invalid', reason: 'maximum' };
  const controlled = mode === 'fraction' && !absent(snapPoint);
  let selection: number | null = null;
  if (mode === 'fraction') {
    const value = controlled
      ? snapPoint
      : absent(defaultSnapPoint)
        ? points[points.length - 1]
        : defaultSnapPoint;
    if (!finite(value)) return { status: 'invalid', reason: 'snap-selection' };
    selection = points.reduce((best, point) =>
      Math.abs(point - value) <= Math.abs(best - value) ? point : best
    );
  }
  return {
    status: 'ready',
    mode,
    points,
    controlled,
    selection,
    minimum: mode === 'intrinsic' ? minimum : { unit: 'logical', value: 0 },
    maximum,
  };
}
