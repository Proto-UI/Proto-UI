/** Portable visual intent. Concrete optical/native profiles belong to the host. */
export type MaterialCandidate =
  | Readonly<{
      intent: 'liquid-glass';
      variant?: 'regular' | 'clear';
      deformation?: Readonly<{ kind: 'press'; phase: 'rest' | 'pressed' }>;
    }>
  | Readonly<{ intent: 'adaptive-blur'; tone?: 'system' | 'light' | 'dark' }>;

export type MaterialIntent = MaterialCandidate['intent'];
export type MaterialSourceRequest =
  | Readonly<{ kind: 'owned-scene'; slot: string }>
  | Readonly<{ kind: 'in-app-backdrop' }>
  | Readonly<{ kind: 'behind-window' }>;

/** One owned slot. Colors are resolved from governed final style IR by the host. */
export type MaterialSlot = Readonly<{
  version: 2;
  shape: Readonly<{ kind: 'rounded-rect'; geometry: 'style' }>;
  source: MaterialSourceRequest;
  fallback: Readonly<{ fill: 'style'; foreground: 'style' }>;
}>;

export type MaterialIntentFrame = Readonly<{
  slot: MaterialSlot | null;
  candidates: readonly MaterialCandidate[];
}>;

// Inspect data properties without executing author-supplied getters. The
// portable payload accepts neither class instances nor inherited fields.
function record(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || ![...required, ...optional].includes(key)))
    return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
    result[key] = descriptor.value;
  }
  return required.every((key) => Object.hasOwn(result, key)) ? result : null;
}

export function snapshotMaterialCandidate(value: unknown): MaterialCandidate {
  const kind = record(value, ['intent'], ['variant', 'deformation', 'tone']);
  if (kind?.intent === 'liquid-glass') {
    const candidate = record(value, ['intent'], ['variant', 'deformation']);
    if (!candidate) throw new Error('Invalid liquid-glass material intent');
    if (
      Object.hasOwn(candidate, 'variant') &&
      candidate.variant !== 'regular' &&
      candidate.variant !== 'clear'
    )
      throw new Error('Invalid liquid-glass variant');
    let deformation: Extract<MaterialCandidate, { intent: 'liquid-glass' }>['deformation'];
    if (Object.hasOwn(candidate, 'deformation')) {
      const data = record(candidate.deformation, ['kind', 'phase']);
      if (data?.kind !== 'press' || (data.phase !== 'rest' && data.phase !== 'pressed'))
        throw new Error('Invalid finite material deformation');
      deformation = Object.freeze({ kind: 'press', phase: data.phase });
    }
    return Object.freeze({
      intent: 'liquid-glass',
      ...(candidate.variant ? { variant: candidate.variant as 'regular' | 'clear' } : {}),
      ...(deformation ? { deformation } : {}),
    });
  }
  if (kind?.intent === 'adaptive-blur') {
    const candidate = record(value, ['intent'], ['tone']);
    if (
      !candidate ||
      (Object.hasOwn(candidate, 'tone') &&
        candidate.tone !== 'system' &&
        candidate.tone !== 'light' &&
        candidate.tone !== 'dark')
    )
      throw new Error('Invalid adaptive-blur material intent');
    return Object.freeze({
      intent: 'adaptive-blur',
      ...(candidate.tone ? { tone: candidate.tone as 'system' | 'light' | 'dark' } : {}),
    });
  }
  throw new Error('Unknown material intent');
}

export function snapshotMaterialSlot(value: unknown): MaterialSlot {
  const slot = record(value, ['version', 'shape', 'source', 'fallback']);
  const shape = record(slot?.shape, ['kind', 'geometry']);
  const fallback = record(slot?.fallback, ['fill', 'foreground']);
  if (
    slot?.version !== 2 ||
    shape?.kind !== 'rounded-rect' ||
    shape.geometry !== 'style' ||
    fallback?.fill !== 'style' ||
    fallback.foreground !== 'style'
  )
    throw new Error('Invalid material slot');
  const source = record(slot.source, ['kind'], ['slot']);
  let copy: MaterialSourceRequest;
  if (
    source?.kind === 'owned-scene' &&
    typeof source.slot === 'string' &&
    /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(source.slot)
  ) {
    copy = Object.freeze({ kind: 'owned-scene', slot: source.slot });
  } else if (
    source &&
    !Object.hasOwn(source, 'slot') &&
    (source.kind === 'in-app-backdrop' || source.kind === 'behind-window')
  ) {
    copy = Object.freeze({ kind: source.kind });
  } else throw new Error('Invalid material source request');
  return Object.freeze({
    version: 2,
    shape: Object.freeze({ kind: 'rounded-rect', geometry: 'style' }),
    source: copy,
    fallback: Object.freeze({ fill: 'style', foreground: 'style' }),
  });
}
