export function resizeValue(value: number, min = 10, max = 90, collapsible = false): number {
  const low = Math.max(0, Math.min(100, Number.isFinite(min) ? min : 10));
  const high = Math.max(low, Math.min(100, Number.isFinite(max) ? max : 90));
  if (!Number.isFinite(value)) return low;
  if (collapsible && value < low / 2) return 0;
  return Math.round(Math.max(low, Math.min(high, value)) * 100) / 100;
}

/** Percentages of the complete group; a collapsed size is a discrete stop. */
export interface ResizablePanelConstraint {
  min?: number;
  max?: number;
  collapsible?: boolean;
  collapsedSize?: number;
}
export type ResizableConstraint = Readonly<{
  min: number;
  max: number;
  collapsible: boolean;
  collapsedSize: number;
}>;
const EPSILON = 1e-7;

function validConstraint(value: unknown): value is ResizableConstraint {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const c = value as ResizableConstraint;
  return (
    typeof c.collapsible === 'boolean' &&
    [c.min, c.max, c.collapsedSize].every(Number.isFinite) &&
    c.min >= 0 &&
    c.max <= 100 &&
    c.min <= c.max &&
    c.collapsedSize >= 0 &&
    c.collapsedSize <= c.min
  );
}

export function resizableConstraints(
  count: number,
  constraints: readonly ResizablePanelConstraint[] = []
): readonly ResizableConstraint[] | null {
  if (
    !Number.isInteger(count) ||
    count < 2 ||
    !Array.isArray(constraints) ||
    constraints.length > count
  )
    return null;
  const result: ResizableConstraint[] = [];
  for (let i = 0; i < count; i++) {
    // Only an omitted trailing entry uses defaults. An interior hole, null,
    // array or explicit non-object entry is a malformed constraint.
    if (i < constraints.length && !Object.hasOwn(constraints, i)) return null;
    const source = i < constraints.length ? constraints[i] : {};
    if (typeof source !== 'object' || source === null || Array.isArray(source)) return null;
    const constraint = {
      min: source.min === undefined ? 0 : source.min,
      max: source.max === undefined ? 100 : source.max,
      collapsedSize: source.collapsedSize === undefined ? 0 : source.collapsedSize,
      collapsible: source.collapsible === undefined ? false : source.collapsible,
    };
    if (!validConstraint(constraint)) return null;
    result.push(Object.freeze(constraint));
  }
  return Object.freeze(result);
}

type Bounds = Readonly<{ min: number; max: number }>;
const collapsedBounds = (c: ResizableConstraint): Bounds => ({
  min: c.collapsedSize,
  max: c.collapsedSize,
});
const prefersCollapsed = (c: ResizableConstraint, desired: number) =>
  c.collapsible && desired < (c.min + c.collapsedSize) / 2;

/** Pick one feasible product of intervals, retaining the preferred one first. */
function projectionBounds(
  desired: readonly number[],
  constraints: readonly ResizableConstraint[]
): readonly Bounds[] | null {
  const bounds: Bounds[] = constraints.map((c, i) =>
    prefersCollapsed(c, desired[i]) ? collapsedBounds(c) : c
  );
  const preferredMin = bounds.reduce((sum, c) => sum + c.min, 0),
    preferredMax = bounds.reduce((sum, c) => sum + c.max, 0);
  // The usual drag/layout path keeps the original linear projection. Search
  // is needed only when its chosen collapsed/expanded combination cannot fit.
  if (preferredMin <= 100 + EPSILON && preferredMax >= 100 - EPSILON) return bounds;

  const choices: Array<{ index: number; preferred: Bounds; alternate: Bounds }> = [];
  let fixedMin = 0,
    fixedMax = 0;
  constraints.forEach((c, index) => {
    if (c.collapsible && c.collapsedSize < c.min) {
      const collapsed = collapsedBounds(c);
      choices.push({
        index,
        preferred: prefersCollapsed(c, desired[index]) ? collapsed : c,
        alternate: prefersCollapsed(c, desired[index]) ? c : collapsed,
      });
    } else {
      // When collapsedSize === min, the stop is already in the expanded
      // interval. Its union is continuous, so no discrete branch is necessary.
      bounds[index] = c;
      fixedMin += c.min;
      fixedMax += c.max;
    }
  });
  const suffixMin = new Array<number>(choices.length + 1).fill(0),
    suffixMax = new Array<number>(choices.length + 1).fill(0);
  for (let i = choices.length - 1; i >= 0; i--) {
    const c = constraints[choices[i].index];
    suffixMin[i] = suffixMin[i + 1] + c.collapsedSize;
    suffixMax[i] = suffixMax[i + 1] + c.max;
  }
  const low = [fixedMin],
    high = [fixedMax],
    attempts = new Array<number>(choices.length).fill(0);
  let depth = 0;
  // Iterative depth-first search avoids call-stack dependence on panel count.
  // Suffix bounds prune branches that cannot possibly make a total of 100.
  while (depth >= 0) {
    if (
      low[depth] + suffixMin[depth] > 100 + EPSILON ||
      high[depth] + suffixMax[depth] < 100 - EPSILON
    ) {
      depth--;
      continue;
    }
    if (depth === choices.length) return bounds;
    if (attempts[depth] === 2) {
      depth--;
      continue;
    }
    const choice = choices[depth];
    const selected = attempts[depth]++ === 0 ? choice.preferred : choice.alternate;
    bounds[choice.index] = selected;
    low[depth + 1] = low[depth] + selected.min;
    high[depth + 1] = high[depth] + selected.max;
    depth++;
    if (depth < choices.length) attempts[depth] = 0;
  }
  return null;
}

/** Bounded simplex projection. Every result is a fresh complete immutable snapshot. */
export function normalizeResizableSizes(
  input: readonly number[],
  constraints: readonly ResizableConstraint[]
): readonly number[] | null {
  if (
    !Array.isArray(input) ||
    input.length < 2 ||
    !Array.isArray(constraints) ||
    input.length !== constraints.length
  )
    return null;
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    if (
      !Object.hasOwn(input, i) ||
      !Number.isFinite(input[i]) ||
      input[i] < 0 ||
      !Object.hasOwn(constraints, i) ||
      !validConstraint(constraints[i])
    )
      return null;
    sum += input[i];
  }
  if (!Number.isFinite(sum) || sum <= 0) return null;
  const desired = input.map((x) => (x / sum) * 100);
  const bounds = projectionBounds(desired, constraints);
  if (!bounds) return null;
  const next = desired.map((x, i) => Math.max(bounds[i].min, Math.min(bounds[i].max, x)));
  for (let pass = 0; pass <= next.length; pass++) {
    const remaining = 100 - next.reduce((a, b) => a + b, 0);
    if (Math.abs(remaining) <= EPSILON) break;
    const adjustable = next
      .map((value, i) => ({ value, i }))
      .filter(({ value, i }) => (remaining > 0 ? value < bounds[i].max : value > bounds[i].min));
    if (!adjustable.length) return null;
    for (const { i } of adjustable)
      next[i] = Math.max(
        bounds[i].min,
        Math.min(bounds[i].max, next[i] + remaining / adjustable.length)
      );
  }
  const residual = 100 - next.reduce((a, b) => a + b, 0);
  if (Math.abs(residual) > EPSILON) return null;
  const correction = next.findIndex(
    (x, i) => x + residual >= bounds[i].min && x + residual <= bounds[i].max
  );
  if (correction >= 0) next[correction] += residual;
  return Object.freeze(next);
}

function boundaryIntervals(
  sizes: readonly number[],
  constraints: readonly ResizableConstraint[],
  index: number
): readonly (readonly [number, number])[] {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= sizes.length - 1 ||
    constraints.length !== sizes.length
  )
    return [];
  const total = sizes[index] + sizes[index + 1];
  const ranges = (c: ResizableConstraint): (readonly [number, number])[] =>
    c.collapsible
      ? [
          [c.min, c.max],
          [c.collapsedSize, c.collapsedSize],
        ]
      : [[c.min, c.max]];
  const intervals: (readonly [number, number])[] = [];
  for (const a of ranges(constraints[index]))
    for (const b of ranges(constraints[index + 1])) {
      const low = Math.max(a[0], total - b[1]),
        high = Math.min(a[1], total - b[0]);
      if (low <= high) intervals.push([low, high]);
    }
  return intervals;
}

export function resizableBoundaryBounds(
  sizes: readonly number[],
  constraints: readonly ResizableConstraint[],
  index: number
): readonly [number, number] | null {
  const intervals = boundaryIntervals(sizes, constraints, index);
  return intervals.length
    ? [Math.min(...intervals.map((x) => x[0])), Math.max(...intervals.map((x) => x[1]))]
    : null;
}

export function resizeAdjacentPanels(
  sizes: readonly number[],
  constraints: readonly ResizableConstraint[],
  index: number,
  value: number
): readonly number[] | null {
  if (!Number.isFinite(value)) return null;
  const intervals = boundaryIntervals(sizes, constraints, index);
  let selected: number | undefined,
    distance = Infinity;
  // Expanded intervals precede collapsed stops, so an exact midpoint stays expanded.
  for (const [low, high] of intervals) {
    const candidate = Math.max(low, Math.min(high, value));
    if (Math.abs(candidate - value) < distance) {
      selected = candidate;
      distance = Math.abs(candidate - value);
    }
  }
  if (selected === undefined) return null;
  const next = [...sizes];
  next[index] = selected;
  next[index + 1] = sizes[index] + sizes[index + 1] - selected;
  return Object.freeze(next);
}
