/** Experimental, private data resolver. Not exported, wired to a host, or evidence of atomic paint. */
export type Rgba = [number, number, number, 1];
export type PaintChannel = 'fill' | 'background-image' | 'backdrop' | 'coat';
export type Stamp = {
  target: number;
  source: number;
  surface: string;
  binding: number;
  view: number;
  geometry: number;
  frame: number;
};
export type MaterialCandidate = {
  kind: 'refractive';
  version: 1;
  model: 'heightfield-v1';
  variant: 'regular' | 'clear';
  phase: 'rest' | 'pressed';
  anchor: 'center';
};
export type VisualInput = {
  stamp: Stamp;
  style: {
    tokens: string[];
    provenance: 'post-patch-complete' | 'selector-dependent' | 'unknown';
    paint: Array<{ channel: PaintChannel; tokens: string[] }>;
    foreground: Rgba;
  };
  geometry: { width: number; height: number; radius: number; dpr: number; axisAligned: boolean };
  slot: null | { fallback: { fill: Rgba; foreground: Rgba }; candidates: MaterialCandidate[] };
  support: true | false | 'unknown';
  preferences: {
    reducedMotion: string;
    reducedTransparency: string;
    contrast: string;
    forcedColors: string;
  };
};
export type VisualSnapshot = {
  stamp: Stamp;
  style: { tokens: string[]; clearPaint: PaintChannel[]; foreground: Rgba };
  geometry: VisualInput['geometry'] | null;
  material: null | {
    requested: 'portable-model' | null;
    quality: 'portable-model' | 'opaque-fallback';
    candidate: MaterialCandidate | null;
    fallback: { fill: Rgba; foreground: Rgba };
  };
  diagnostics: string[];
};
const resolvedSnapshots = new WeakSet<object>();
const PAINT: PaintChannel[] = ['fill', 'background-image', 'backdrop', 'coat'];
const CANDIDATE_KEYS = ['kind', 'version', 'model', 'variant', 'phase', 'anchor'];
function denseStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i) || typeof value[i] !== 'string') return false;
  }
  return true;
}
function opaque(value: unknown): value is Rgba {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value[3] === 1 &&
    [0, 1, 2, 3].every(
      (i) =>
        Object.hasOwn(value, i) &&
        typeof value[i] === 'number' &&
        Number.isFinite(value[i]) &&
        value[i] >= 0 &&
        value[i] <= 1
    )
  );
}
function validCandidate(value: unknown): value is MaterialCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).length === CANDIDATE_KEYS.length &&
    Object.keys(v).every((k) => CANDIDATE_KEYS.includes(k)) &&
    v.kind === 'refractive' &&
    v.version === 1 &&
    v.model === 'heightfield-v1' &&
    (v.variant === 'regular' || v.variant === 'clear') &&
    (v.phase === 'rest' || v.phase === 'pressed') &&
    v.anchor === 'center'
  );
}
function frozenCopy<T>(value: T): T {
  const clone = structuredClone(value);
  function freeze(v: unknown) {
    if (!v || typeof v !== 'object' || Object.isFrozen(v)) return;
    for (const child of Object.values(v)) freeze(child);
    Object.freeze(v);
  }
  freeze(clone);
  return clone;
}
function resolvedCopy(value: VisualSnapshot): VisualSnapshot {
  const result = frozenCopy(value);
  resolvedSnapshots.add(result);
  return result;
}
function validateStamp(stamp: Stamp) {
  if (
    !stamp ||
    typeof stamp.surface !== 'string' ||
    stamp.surface.length === 0 ||
    stamp.surface.length > 256 ||
    ![stamp.target, stamp.source, stamp.view, stamp.binding, stamp.geometry, stamp.frame].every(
      (x) => Number.isSafeInteger(x) && x >= 0
    )
  )
    throw new Error('Invalid visual identity');
}
export function resolveVisualResult(input: VisualInput): VisualSnapshot {
  validateStamp(input.stamp);
  if (!opaque(input.style.foreground) || !denseStrings(input.style.tokens))
    throw new Error('Invalid final authored style');
  const geometry = input.geometry;
  const validGeometry =
    geometry.axisAligned === true &&
    [geometry.width, geometry.height, geometry.radius, geometry.dpr].every(Number.isFinite) &&
    geometry.width > 0 &&
    geometry.height > 0 &&
    geometry.radius >= 0 &&
    geometry.dpr >= 0.5 &&
    geometry.dpr <= 3 &&
    Math.ceil(geometry.width * geometry.dpr) * Math.ceil(geometry.height * geometry.dpr) <=
      1_048_576;
  const result: VisualSnapshot = {
    stamp: { ...input.stamp },
    style: { tokens: [...input.style.tokens], clearPaint: [], foreground: input.style.foreground },
    geometry: validGeometry
      ? { ...geometry, radius: Math.min(geometry.radius, geometry.width / 2, geometry.height / 2) }
      : null,
    material: null,
    diagnostics: [],
  };
  // A tombstone relinquishes material ownership. It must not keep fallback paint alive.
  if (input.slot === null) return resolvedCopy(result);
  const fallback = input.slot.fallback;
  if (
    !fallback ||
    !opaque(fallback.fill) ||
    !opaque(fallback.foreground) ||
    fallback.foreground.some((v, i) => v !== input.style.foreground[i])
  )
    throw new Error('Missing or inconsistent resolved opaque fallback palette');
  const removed = new Set<string>();
  if (!Array.isArray(input.style.paint)) throw new Error('Invalid post-patch paint provenance');
  for (const contribution of input.style.paint) {
    if (
      !contribution ||
      !PAINT.includes(contribution.channel) ||
      !denseStrings(contribution.tokens) ||
      contribution.tokens.some((token) => !input.style.tokens.includes(token))
    )
      throw new Error('Invalid post-patch paint provenance');
    for (const token of contribution.tokens) removed.add(token);
  }
  // The integration must derive this provenance after Rule/runtime patches. No CSS inference here.
  result.style.tokens = result.style.tokens.filter((token) => !removed.has(token));
  result.style.clearPaint = [...PAINT];
  const validList = Array.isArray(input.slot.candidates);
  const candidates = validList ? input.slot.candidates : [];
  const candidate = candidates.length === 1 && validCandidate(candidates[0]) ? candidates[0] : null;
  if (!validList) result.diagnostics.push('invalid-material-candidate');
  else if (candidates.length === 0) result.diagnostics.push('no-active-material-candidate');
  if (candidates.length > 1) result.diagnostics.push('material-candidate-conflict');
  if (candidates.length === 1 && !candidate) result.diagnostics.push('invalid-material-candidate');
  if (input.style.paint.length) result.diagnostics.push('conflicting-authored-paint');
  if (input.style.provenance !== 'post-patch-complete')
    result.diagnostics.push('unresolved-style-provenance');
  if (!validGeometry) result.diagnostics.push('geometry-unavailable');
  if (input.support !== true) result.diagnostics.push('material-support-unavailable');
  if (
    input.preferences.reducedMotion !== 'no-preference' ||
    input.preferences.reducedTransparency !== 'no-preference' ||
    input.preferences.contrast !== 'no-preference' ||
    input.preferences.forcedColors !== 'none'
  )
    result.diagnostics.push('unsafe-or-unknown-preference');
  result.material = {
    requested: candidate ? 'portable-model' : null,
    quality: result.diagnostics.length ? 'opaque-fallback' : 'portable-model',
    candidate: result.diagnostics.length ? null : candidate,
    fallback,
  };
  return resolvedCopy(result);
}

export type MaterialResource = { release(): void };
export type PreparationTicket = Readonly<{ serial: number; snapshot: VisualSnapshot }>;
/** Pure ownership/retirement model. commit must become one actual host transaction in a later slice. */
export function createVisualTransactionGate(commit: (snapshot: VisualSnapshot) => void) {
  let serial = 0;
  let disposed = false;
  let publication = 0;
  let pending: PreparationTicket | null = null;
  let latest: VisualSnapshot | null = null;
  let resource: MaterialResource | null = null;
  const released = new WeakSet<MaterialResource>();
  function release(value: MaterialResource | null) {
    if (value && value !== resource && !released.has(value)) {
      released.add(value);
      value.release();
    }
  }
  function publish(snapshot: VisualSnapshot, replacement: MaterialResource | null) {
    const turn = ++publication;
    const previous = resource;
    // Reentrant loss/dispose must see and retire the resource currently being committed.
    resource = replacement;
    try {
      commit(snapshot);
    } catch (error) {
      if (publication === turn) {
        resource = replacement === null ? null : previous;
        if (replacement === null) release(previous);
      } else release(previous);
      release(replacement);
      throw error;
    }
    if (previous !== replacement) release(previous);
    if (publication !== turn && resource !== replacement) release(replacement);
  }
  function fallback(
    snapshot: VisualSnapshot,
    reason: string,
    source = snapshot.stamp.source
  ): VisualSnapshot {
    return frozenCopy({
      ...snapshot,
      stamp: { ...snapshot.stamp, source },
      material: snapshot.material
        ? { ...snapshot.material, quality: 'opaque-fallback' as const, candidate: null }
        : null,
      diagnostics: [...snapshot.diagnostics, reason],
    });
  }
  return {
    inspect() {
      return { disposed, pending: pending !== null, hasResource: resource !== null };
    },
    begin(snapshot: VisualSnapshot): PreparationTicket {
      if (disposed) throw new Error('Visual transaction gate is disposed');
      if (!resolvedSnapshots.has(snapshot)) throw new Error('Rejected unresolved visual snapshot');
      const old = latest?.stamp,
        next = snapshot.stamp;
      if (
        old &&
        (next.view < old.view ||
          next.target < old.target ||
          next.source < old.source ||
          (next.view === old.view && next.binding < old.binding) ||
          (next.view === old.view && next.surface !== old.surface && next.binding <= old.binding) ||
          (next.source === old.source && next.view === old.view && next.frame < old.frame) ||
          (next.view === old.view &&
            next.surface === old.surface &&
            next.binding === old.binding &&
            next.geometry < old.geometry) ||
          (next.view === old.view &&
            next.target === old.target &&
            next.source === old.source &&
            next.surface === old.surface &&
            next.binding === old.binding &&
            next.geometry === old.geometry &&
            next.frame <= old.frame))
      )
        throw new Error('Rejected stale visual identity');
      latest = frozenCopy(snapshot);
      const ticket = Object.freeze({ serial: ++serial, snapshot: latest });
      pending = ticket;
      if (snapshot.material?.quality !== 'portable-model') {
        pending = null;
        publish(latest, null);
      } else if (
        !resource ||
        !old ||
        old.view !== next.view ||
        old.source !== next.source ||
        old.surface !== next.surface ||
        old.binding !== next.binding ||
        old.geometry !== next.geometry
      ) {
        // First paint and a retired sampling/geometry lease cannot wait transparently for preparation.
        try {
          publish(fallback(latest, 'material-resource-pending'), null);
        } catch (error) {
          if (pending === ticket) pending = null;
          throw error;
        }
      }
      return ticket;
    },
    complete(ticket: PreparationTicket, replacement: MaterialResource): boolean {
      if (
        !replacement ||
        typeof replacement !== 'object' ||
        typeof replacement.release !== 'function'
      )
        throw new Error('Invalid material resource');
      if (disposed || pending !== ticket || released.has(replacement)) {
        // A duplicate callback can carry the currently committed lease; rejecting
        // that callback does not revoke the resource still owned by this gate.
        if (replacement !== resource) release(replacement);
        return false;
      }
      pending = null;
      publish(ticket.snapshot, replacement);
      return true;
    },
    fail(ticket: PreparationTicket): boolean {
      if (disposed || pending !== ticket) return false;
      pending = null;
      latest = fallback(ticket.snapshot, 'material-resource-preparation-failed');
      publish(latest, null);
      return true;
    },
    sourceLost(source: number) {
      if (disposed || !latest) return;
      if (!Number.isSafeInteger(source) || source <= latest.stamp.source)
        throw new Error('Source loss must advance its lease generation');
      pending = null;
      ++serial;
      latest = fallback(latest, 'material-source-lost', source);
      publish(latest, null);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending = null;
      ++serial;
      ++publication;
      const previous = resource;
      resource = null;
      try {
        if (latest)
          commit(
            frozenCopy({
              ...latest,
              style: { ...latest.style, tokens: [], clearPaint: [...PAINT] },
              material: null,
            })
          );
      } finally {
        release(previous);
        latest = null;
      }
    },
  };
}
