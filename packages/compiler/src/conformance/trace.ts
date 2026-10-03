export type TraceValue =
  | null
  | boolean
  | number
  | string
  | TraceValue[]
  | { [key: string]: TraceValue };

/** Observed checkpoints, not compiler-derived expected output. Arrays retain semantic order. */
export interface SemanticCheckpoint {
  step: string;
  phase: string;
  ownerId: string;
  parentId: string | null;
  viewEpoch: number;
  kind: string;
  data: TraceValue;
}

export interface IdentityNormalization {
  /** Explain which target-local identities differ and why their public role is unchanged. */
  reason: string;
  aliases: Readonly<Record<string, string>>;
}

export interface TraceDifference {
  checkpoint: number;
  path: readonly (string | number)[];
  reference: { present: boolean; value?: unknown };
  candidate: { present: boolean; value?: unknown };
}

export type TraceComparison = { equal: true } | { equal: false; firstDifference: TraceDifference };

function assertValue(value: unknown, path: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || value === null)
    throw new Error(`Invalid trace value at ${path}`);
  if (ancestors.has(value)) throw new Error(`Cyclic trace value at ${path}`);
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new Error(`Non-data trace value at ${path}`);
  }
  ancestors.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string') throw new Error(`Symbol key in trace at ${path}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !('value' in descriptor))
      throw new Error(`Non-data property in trace at ${path}.${key}`);
    assertValue(descriptor.value, `${path}.${key}`, ancestors);
  }
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length)
      throw new Error(`Extended trace array at ${path}`);
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new Error(`Sparse trace array at ${path}`);
    }
  }
  ancestors.delete(value);
}

function freezeData(value: unknown): void {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
}

/** Capture at observation time: later mutation of handles/arrays cannot rewrite history. */
export function snapshotTrace(trace: readonly SemanticCheckpoint[]): readonly SemanticCheckpoint[] {
  assertValue(trace, 'trace');
  for (const entry of trace) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !['step', 'phase', 'ownerId', 'kind'].every(
        (key) =>
          typeof entry[key as keyof SemanticCheckpoint] === 'string' &&
          entry[key as keyof SemanticCheckpoint] !== ''
      ) ||
      !(entry.parentId === null || (typeof entry.parentId === 'string' && entry.parentId !== '')) ||
      !Number.isSafeInteger(entry.viewEpoch) ||
      entry.viewEpoch < 0 ||
      !Object.hasOwn(entry, 'data')
    ) {
      throw new Error('Malformed semantic checkpoint');
    }
  }
  const snapshot = structuredClone(trace) as SemanticCheckpoint[];
  freezeData(snapshot);
  return snapshot;
}

export class TraceRecorder {
  private readonly checkpoints: SemanticCheckpoint[] = [];

  record(checkpoint: SemanticCheckpoint): void {
    this.checkpoints.push(snapshotTrace([checkpoint])[0]);
  }

  snapshot(): readonly SemanticCheckpoint[] {
    return Object.freeze([...this.checkpoints]);
  }
}

/** Only explicitly mapped opaque owner identities may vary; data, ancestry edges and epochs may not. */
export function normalizeTrace(
  trace: readonly SemanticCheckpoint[],
  normalization?: IdentityNormalization
): readonly SemanticCheckpoint[] {
  const snapshot = snapshotTrace(trace);
  if (!normalization) return snapshot;
  if (!normalization.reason.trim()) throw new Error('Identity normalization requires a reason');
  assertValue(normalization.aliases, 'identity aliases');
  const targets = Object.values(normalization.aliases);
  if (targets.some((target) => typeof target !== 'string' || !target))
    throw new Error('Identity aliases require nonempty names');
  if (new Set(targets).size !== targets.length)
    throw new Error('Identity aliases must be injective');
  const owners = new Set(
    snapshot.flatMap((entry) => [
      entry.ownerId,
      ...(entry.parentId === null ? [] : [entry.parentId]),
    ])
  );
  const projected = [...owners].map((id) =>
    Object.hasOwn(normalization.aliases, id) ? normalization.aliases[id] : id
  );
  if (new Set(projected).size !== projected.length)
    throw new Error('Identity aliases collapse observed owners');
  return Object.freeze(
    snapshot.map((entry) =>
      Object.freeze({
        ...entry,
        ownerId: Object.hasOwn(normalization.aliases, entry.ownerId)
          ? normalization.aliases[entry.ownerId]
          : entry.ownerId,
        parentId:
          entry.parentId !== null && Object.hasOwn(normalization.aliases, entry.parentId)
            ? normalization.aliases[entry.parentId]
            : entry.parentId,
      })
    )
  );
}

function difference(
  reference: unknown,
  candidate: unknown,
  path: readonly (string | number)[],
  checkpoint: number
): TraceDifference | undefined {
  if (Object.is(reference, candidate)) return;
  if (
    reference === null ||
    candidate === null ||
    typeof reference !== 'object' ||
    typeof candidate !== 'object' ||
    Array.isArray(reference) !== Array.isArray(candidate)
  ) {
    return {
      checkpoint,
      path,
      reference: { present: true, value: reference },
      candidate: { present: true, value: candidate },
    };
  }
  const left = reference as Record<string, unknown>;
  const right = candidate as Record<string, unknown>;
  const keys = Array.isArray(reference)
    ? Array.from(
        { length: Math.max(reference.length, (candidate as unknown[]).length) },
        (_, index) => String(index)
      )
    : [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    const next = [...path, Array.isArray(reference) ? Number(key) : key];
    const inLeft = Object.hasOwn(left, key);
    const inRight = Object.hasOwn(right, key);
    if (!inLeft || !inRight) {
      return {
        checkpoint,
        path: next,
        reference: { present: inLeft, ...(inLeft ? { value: left[key] } : {}) },
        candidate: { present: inRight, ...(inRight ? { value: right[key] } : {}) },
      };
    }
    const found = difference(left[key], right[key], next, checkpoint);
    if (found) return found;
  }
}

export function compareTraces(
  reference: readonly SemanticCheckpoint[],
  candidate: readonly SemanticCheckpoint[],
  options: {
    referenceIdentity?: IdentityNormalization;
    candidateIdentity?: IdentityNormalization;
  } = {}
): TraceComparison {
  const left = normalizeTrace(reference, options.referenceIdentity);
  const right = normalizeTrace(candidate, options.candidateIdentity);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (index >= left.length || index >= right.length) {
      return {
        equal: false,
        firstDifference: {
          checkpoint: index,
          path: [index],
          reference: {
            present: index < left.length,
            ...(index < left.length ? { value: left[index] } : {}),
          },
          candidate: {
            present: index < right.length,
            ...(index < right.length ? { value: right[index] } : {}),
          },
        },
      };
    }
    const found = difference(left[index], right[index], [index], index);
    if (found) return { equal: false, firstDifference: found };
  }
  return { equal: true };
}
