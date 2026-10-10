import { describe, expect, it } from 'vitest';
import { resolveMaterialPolicy, type MaterialPolicyInput } from '../src/material/shared-policy';

function input(): MaterialPolicyInput {
  return {
    slot: {
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    },
    candidates: [{ intent: 'liquid-glass' }],
    finalStyle: {
      provenance: 'post-patch-complete',
      fill: [0.1, 0.2, 0.3, 1],
      foreground: [1, 1, 1, 1],
      competingPaint: [],
    },
    geometry: { width: 160, height: 40, radius: 10, dpr: 2, axisAligned: true },
    preferences: {
      reducedMotion: 'no-preference',
      reducedTransparency: 'no-preference',
      forcedColors: 'none',
      contrast: 'no-preference',
    },
    source: { kind: 'in-app-backdrop', current: true, sameScope: true, excludesOwnOutput: true },
    provider: {
      backend: 'self-optical',
      profile: 'test-heightfield-v1',
      ready: true,
      sourceKind: 'in-app-backdrop',
      staticSupported: true,
      pressDeformationSupported: true,
      variants: ['regular', 'clear'],
      tones: ['system', 'light', 'dark'],
      maxSurfacePixels: 1_048_576,
    },
  };
}

describe('shared material policy (eligibility, never paint evidence)', () => {
  it('allows static liquid glass without a model or button state in author intent', () => {
    expect(resolveMaterialPolicy(input())).toMatchObject({
      decision: 'eligible',
      requestedIntent: 'liquid-glass',
      selectedBackend: 'self-optical',
      selectedProfile: 'test-heightfield-v1',
      effectiveMotion: 'static',
    });
  });
  it.each(['system-native', 'browser-compositor'] as const)(
    'never fulfills explicit liquid glass with %s',
    (backend) => {
      const data = input();
      const result = resolveMaterialPolicy({ ...data, provider: { ...data.provider!, backend } });
      expect(result).toMatchObject({
        decision: 'opaque-fallback',
        requestedIntent: 'liquid-glass',
        selectedBackend: null,
        diagnostics: ['intent-backend-mismatch'],
      });
    }
  );
  it.each(['system-native', 'browser-compositor'] as const)(
    'admits an eligible adaptive %s in-app provider',
    (backend) => {
      const data = input();
      expect(
        resolveMaterialPolicy({
          ...data,
          candidates: [{ intent: 'adaptive-blur' }],
          provider: { ...data.provider!, backend },
        })
      ).toMatchObject({
        decision: 'eligible',
        requestedIntent: 'adaptive-blur',
        selectedBackend: backend,
      });
    }
  );
  it('cannot substitute the self optical provider for adaptive blur', () => {
    const data = input();
    expect(
      resolveMaterialPolicy({ ...data, candidates: [{ intent: 'adaptive-blur' }] }).diagnostics
    ).toContain('intent-backend-mismatch');
  });
  it('does not grant browser compositors behind-window capture by claiming that scope', () => {
    const data = input();
    expect(
      resolveMaterialPolicy({
        ...data,
        slot: { ...data.slot!, source: { kind: 'behind-window' } },
        candidates: [{ intent: 'adaptive-blur' }],
        source: { ...data.source!, kind: 'behind-window' },
        provider: { ...data.provider!, backend: 'browser-compositor', sourceKind: 'behind-window' },
      }).diagnostics
    ).toContain('intent-backend-mismatch');
  });
  it.each(['reduce', 'unknown'] as const)(
    'constrains %s motion to static, without forcing opaque',
    (reducedMotion) => {
      const data = input();
      const result = resolveMaterialPolicy({
        ...data,
        candidates: [{ intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } }],
        preferences: { ...data.preferences, reducedMotion },
      });
      expect(result).toMatchObject({ decision: 'eligible', effectiveMotion: 'static' });
      expect(result.overrides).toEqual([
        reducedMotion === 'reduce' ? 'reduced-motion' : 'unknown-motion',
      ]);
    }
  );
  it('reports the specific missing static provider path when motion is constrained', () => {
    const data = input();
    expect(
      resolveMaterialPolicy({
        ...data,
        preferences: { ...data.preferences, reducedMotion: 'reduce' },
        provider: { ...data.provider!, staticSupported: false },
      })
    ).toMatchObject({ decision: 'opaque-fallback', diagnostics: ['static-material-unavailable'] });
  });
  it('retains press intent only when its finite deformation is supported', () => {
    const data = {
      ...input(),
      candidates: [{ intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } }],
    } as MaterialPolicyInput;
    expect(resolveMaterialPolicy(data).effectiveMotion).toBe('press');
    expect(
      resolveMaterialPolicy({
        ...data,
        provider: { ...data.provider!, pressDeformationSupported: false },
      }).diagnostics
    ).toContain('press-deformation-unavailable');
  });
  it.each([
    { reducedTransparency: 'reduce' },
    { reducedTransparency: 'unknown' },
    { forcedColors: 'active' },
    { forcedColors: 'unknown' },
    { contrast: 'more' },
    { contrast: 'unknown' },
  ] as const)('selects opaque on live transparency/contrast override %j', (preference) => {
    const data = input();
    expect(
      resolveMaterialPolicy({ ...data, preferences: { ...data.preferences, ...preference } })
    ).toMatchObject({
      decision: 'opaque-fallback',
      diagnostics: ['transparency-or-contrast-override'],
    });
  });
  it.each(['current', 'sameScope', 'excludesOwnOutput'] as const)(
    'refuses a source without %s',
    (key) => {
      const data = input();
      expect(
        resolveMaterialPolicy({ ...data, source: { ...data.source!, [key]: false } }).diagnostics
      ).toContain('source-lease-unavailable-or-mismatched');
    }
  );
  it('requires the exact owned-scene logical binding and source kind', () => {
    const data = input();
    const slot = { ...data.slot!, source: { kind: 'owned-scene' as const, slot: 'scene' } };
    expect(resolveMaterialPolicy({ ...data, slot }).decision).toBe('opaque-fallback');
    expect(
      resolveMaterialPolicy({
        ...data,
        slot,
        source: { ...data.source!, kind: 'owned-scene', slot: 'other' },
      }).diagnostics
    ).toContain('source-lease-unavailable-or-mismatched');
  });
  it('a syntax probe/provider announcement without ready resources cannot enhance', () => {
    const data = input();
    expect(
      resolveMaterialPolicy({ ...data, provider: { ...data.provider!, ready: false } }).decision
    ).toBe('opaque-fallback');
    expect(resolveMaterialPolicy({ ...data, source: null }).decision).toBe('opaque-fallback');
  });
  it('distinguishes removal, zero candidates and conflicting whole values', () => {
    const data = input();
    expect(resolveMaterialPolicy({ ...data, slot: null })).toMatchObject({
      decision: 'removed',
      fallback: null,
      preserveStyle: true,
    });
    expect(resolveMaterialPolicy({ ...data, candidates: [] }).diagnostics).toEqual([
      'no-active-material-candidate',
    ]);
    expect(
      resolveMaterialPolicy({ ...data, candidates: [data.candidates[0], data.candidates[0]] })
        .diagnostics
    ).toEqual(['material-candidate-conflict']);
  });
  it('preserves original style when an owned opaque fallback cannot be established', () => {
    const data = input();
    for (const change of [
      { fill: null },
      { foreground: null },
      { fill: [0, 0, 0, 0.5] },
      { provenance: 'selector-dependent' },
      { competingPaint: ['backdrop'] },
    ]) {
      const result = resolveMaterialPolicy({
        ...data,
        finalStyle: { ...data.finalStyle, ...change },
      } as MaterialPolicyInput);
      expect(result).toMatchObject({
        decision: 'unavailable',
        preserveStyle: true,
        fallback: null,
      });
    }
  });
  it('copies current theme colors without another palette owner', () => {
    const data = input();
    const fill: [number, number, number, 1] = [0.1, 0.2, 0.3, 1];
    const result = resolveMaterialPolicy({ ...data, finalStyle: { ...data.finalStyle, fill } });
    fill[0] = 0.9;
    expect(result.fallback?.fill).toEqual([0.1, 0.2, 0.3, 1]);
    expect(Object.isFrozen(result.fallback?.fill)).toBe(true);
  });
  it.each([NaN, Infinity, -1, 0])('rejects invalid or empty geometry %s', (width) => {
    const data = input();
    expect(resolveMaterialPolicy({ ...data, geometry: { ...data.geometry, width } }).decision).toBe(
      'opaque-fallback'
    );
  });
  it('applies a concrete provider budget rather than a public fixed surface limit', () => {
    const data = input();
    expect(
      resolveMaterialPolicy({ ...data, provider: { ...data.provider!, maxSurfacePixels: 100 } })
        .diagnostics
    ).toContain('geometry-or-provider-budget-unavailable');
  });
});
