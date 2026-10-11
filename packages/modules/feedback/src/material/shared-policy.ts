import {
  snapshotMaterialCandidate,
  snapshotMaterialSlot,
  type MaterialCandidate,
  type MaterialIntent,
  type MaterialSlot,
} from '@proto.ui/core';

type Rgba = readonly [number, number, number, 1];
export type MaterialBackend = 'self-optical' | 'system-native' | 'browser-compositor';

/** Trusted host facts, never candidate fields. Eligibility is NOT a paint receipt. */
export type MaterialProviderFacts = Readonly<{
  backend: MaterialBackend;
  profile: string;
  ready: boolean;
  sourceKind: MaterialSlot['source']['kind'];
  staticSupported: boolean;
  pressDeformationSupported: boolean;
  variants: readonly ('regular' | 'clear')[];
  tones: readonly ('system' | 'light' | 'dark')[];
  maxSurfacePixels: number;
}>;

export type MaterialPolicyInput = Readonly<{
  slot: MaterialSlot | null;
  candidates: readonly MaterialCandidate[];
  finalStyle: Readonly<{
    provenance: 'post-patch-complete' | 'selector-dependent' | 'unknown';
    fill: Rgba | null;
    foreground: Rgba | null;
    competingPaint: readonly ('background-image' | 'backdrop' | 'coat')[];
  }>;
  geometry: Readonly<{
    width: number;
    height: number;
    radius: number;
    dpr: number;
    axisAligned: boolean;
  }>;
  preferences: Readonly<{
    reducedTransparency: 'no-preference' | 'reduce' | 'unknown';
    reducedMotion: 'no-preference' | 'reduce' | 'unknown';
    contrast: 'no-preference' | 'more' | 'less' | 'custom' | 'unknown';
    forcedColors: 'none' | 'active' | 'unknown';
  }>;
  source: Readonly<{
    kind: MaterialSlot['source']['kind'];
    slot?: string;
    current: boolean;
    sameScope: boolean;
    excludesOwnOutput: boolean;
  }> | null;
  provider: MaterialProviderFacts | null;
}>;

export type MaterialPolicyResult = Readonly<{
  decision: 'removed' | 'unavailable' | 'opaque-fallback' | 'eligible';
  requestedIntent: MaterialIntent | null;
  requestedSource: MaterialSlot['source'] | null;
  selectedBackend: MaterialBackend | null;
  selectedProfile: string | null;
  effectiveMotion: 'static' | 'press' | null;
  fallback: Readonly<{ fill: Rgba; foreground: Rgba }> | null;
  preserveStyle: boolean;
  diagnostics: readonly string[];
  overrides: readonly ('reduced-motion' | 'unknown-motion')[];
}>;

function opaque(value: unknown): value is Rgba {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value[3] === 1 &&
    [0, 1, 2, 3].every(
      (i) => Object.hasOwn(value, i) && Number.isFinite(value[i]) && value[i] >= 0 && value[i] <= 1
    )
  );
}

/** Pure policy only: no resource acquisition, computed CSS, input or host paint. */
export function resolveMaterialPolicy(input: MaterialPolicyInput): MaterialPolicyResult {
  const result = {
    decision: 'removed',
    requestedIntent: null,
    requestedSource: null,
    selectedBackend: null,
    selectedProfile: null,
    effectiveMotion: null,
    fallback: null,
    preserveStyle: true,
    diagnostics: [],
    overrides: [],
  } as {
    -readonly [K in keyof MaterialPolicyResult]: K extends 'diagnostics'
      ? string[]
      : K extends 'overrides'
        ? Array<'reduced-motion' | 'unknown-motion'>
        : MaterialPolicyResult[K];
  };
  const finish = (): MaterialPolicyResult => {
    Object.freeze(result.diagnostics);
    Object.freeze(result.overrides);
    return Object.freeze(result);
  };
  if (input.slot === null) return finish();
  result.decision = 'unavailable';
  let slot: MaterialSlot;
  try {
    slot = snapshotMaterialSlot(input.slot);
  } catch {
    result.diagnostics.push('invalid-material-slot');
    return finish();
  }
  result.requestedSource = slot.source;
  let candidate: MaterialCandidate | null = null;
  const candidates = input.candidates;
  if (!Array.isArray(candidates) || candidates.length !== 1) {
    result.diagnostics.push(
      Array.isArray(candidates) && candidates.length === 0
        ? 'no-active-material-candidate'
        : 'material-candidate-conflict'
    );
  } else {
    try {
      candidate = snapshotMaterialCandidate(candidates[0]);
      result.requestedIntent = candidate.intent;
    } catch {
      result.diagnostics.push('invalid-material-candidate');
    }
  }
  const style = input.finalStyle;
  if (
    style.provenance !== 'post-patch-complete' ||
    !opaque(style.fill) ||
    !opaque(style.foreground) ||
    !Array.isArray(style.competingPaint) ||
    style.competingPaint.length !== 0
  ) {
    result.diagnostics.push('unresolved-owned-opaque-fallback');
    return finish();
  }
  result.fallback = Object.freeze({
    fill: Object.freeze([...style.fill]) as Rgba,
    foreground: Object.freeze([...style.foreground]) as Rgba,
  });
  result.preserveStyle = false;
  result.decision = 'opaque-fallback';
  if (!candidate || result.diagnostics.length) return finish();
  const preferences = input.preferences;
  if (
    preferences.reducedTransparency !== 'no-preference' ||
    preferences.forcedColors !== 'none' ||
    preferences.contrast !== 'no-preference'
  ) {
    result.diagnostics.push('transparency-or-contrast-override');
    return finish();
  }
  const motionLimited = preferences.reducedMotion !== 'no-preference';
  if (motionLimited)
    result.overrides.push(
      preferences.reducedMotion === 'reduce' ? 'reduced-motion' : 'unknown-motion'
    );
  const source = input.source;
  if (
    !source ||
    source.current !== true ||
    source.sameScope !== true ||
    source.excludesOwnOutput !== true ||
    source.kind !== slot.source.kind ||
    (slot.source.kind === 'owned-scene' && source.slot !== slot.source.slot)
  ) {
    result.diagnostics.push('source-lease-unavailable-or-mismatched');
    return finish();
  }
  const provider = input.provider;
  if (
    !provider ||
    provider.ready !== true ||
    !provider.profile ||
    provider.sourceKind !== source.kind
  ) {
    result.diagnostics.push('provider-unavailable-or-mismatched');
    return finish();
  }
  const compatible =
    candidate.intent === 'liquid-glass'
      ? provider.backend === 'self-optical'
      : provider.backend === 'system-native' ||
        (provider.backend === 'browser-compositor' && source.kind === 'in-app-backdrop');
  if (!compatible) {
    result.diagnostics.push('intent-backend-mismatch');
    return finish();
  }
  const wantsPress = candidate.intent === 'liquid-glass' && !!candidate.deformation;
  const effectiveMotion = wantsPress && !motionLimited ? 'press' : 'static';
  if (
    (effectiveMotion === 'static' && provider.staticSupported !== true) ||
    (effectiveMotion === 'press' && provider.pressDeformationSupported !== true)
  ) {
    result.diagnostics.push(
      effectiveMotion === 'static' ? 'static-material-unavailable' : 'press-deformation-unavailable'
    );
    return finish();
  }
  if (
    candidate.intent === 'liquid-glass'
      ? !provider.variants.includes(candidate.variant ?? 'regular')
      : !provider.tones.includes(candidate.tone ?? 'system')
  ) {
    result.diagnostics.push('material-parameters-unavailable');
    return finish();
  }
  const g = input.geometry;
  const pixels = g.width * g.height * g.dpr * g.dpr;
  if (
    ![g.width, g.height, g.radius, g.dpr, provider.maxSurfacePixels].every(Number.isFinite) ||
    g.width <= 0 ||
    g.height <= 0 ||
    g.radius < 0 ||
    g.dpr <= 0 ||
    g.axisAligned !== true ||
    !Number.isFinite(pixels) ||
    provider.maxSurfacePixels <= 0 ||
    pixels > provider.maxSurfacePixels
  ) {
    result.diagnostics.push('geometry-or-provider-budget-unavailable');
    return finish();
  }
  result.decision = 'eligible';
  result.selectedBackend = provider.backend;
  result.selectedProfile = provider.profile;
  result.effectiveMotion = effectiveMotion;
  return finish();
}
