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
  it('requires a current reservation only for an explicitly opted-in slot and retains all source guards', () => {
    const data = input();
    const declared = { ...data, slot: { ...data.slot!, paintReservation: 'required' as const } };
    expect(resolveMaterialPolicy(declared)).toMatchObject({
      decision: 'opaque-fallback',
      diagnostics: ['paint-reservation-unavailable'],
    });
    expect(resolveMaterialPolicy({ ...declared, paintReservation: 'ready' })).toMatchObject({
      decision: 'eligible',
    });
    expect(
      resolveMaterialPolicy({
        ...declared,
        paintReservation: 'ready',
        source: { ...data.source!, current: false },
      })
    ).toMatchObject({
      decision: 'opaque-fallback',
      diagnostics: ['source-lease-unavailable-or-mismatched'],
    });
    expect(resolveMaterialPolicy(data)).toMatchObject({ decision: 'eligible' });
  });
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

describe('explicit style tint provider admission', () => {
  function tinted(): MaterialPolicyInput {
    const data = input();
    return {
      ...data,
      candidates: [{ intent: 'liquid-glass', tint: 'style-fill' }],
      provider: { ...data.provider!, styleTintVariants: ['regular'] },
    };
  }

  it.each([undefined, 'regular', 'clear'] as const)(
    'requires explicit capability for the actual variant %s',
    (variant) => {
      const data = tinted();
      const candidates = [
        { intent: 'liquid-glass', tint: 'style-fill', ...(variant ? { variant } : {}) },
      ] as MaterialPolicyInput['candidates'];
      const regularOnly = resolveMaterialPolicy({ ...data, candidates });
      expect(regularOnly.decision).toBe(variant === 'clear' ? 'opaque-fallback' : 'eligible');
      expect(regularOnly.diagnostics).toEqual(
        variant === 'clear' ? ['style-tint-unavailable'] : []
      );
      const bothVariants = resolveMaterialPolicy({
        ...data,
        candidates,
        provider: { ...data.provider!, styleTintVariants: Object.freeze(['regular', 'clear']) },
      });
      expect(bothVariants).toMatchObject({
        decision: 'eligible',
        selectedProfile: 'test-heightfield-v1',
        effectiveMotion: 'static',
        diagnostics: [],
      });
      expect(Object.isFrozen(bothVariants)).toBe(true);
    }
  );

  it('does not infer regular capability from clear, even when the variant is omitted', () => {
    const data = tinted();
    expect(
      resolveMaterialPolicy({
        ...data,
        provider: { ...data.provider!, styleTintVariants: ['clear'] },
      })
    ).toMatchObject({ decision: 'opaque-fallback', diagnostics: ['style-tint-unavailable'] });
  });

  it('falls back with one deterministic diagnostic when the optional fact is absent', () => {
    const data = input();
    expect(
      resolveMaterialPolicy({
        ...data,
        candidates: [{ intent: 'liquid-glass', tint: 'style-fill' }],
      })
    ).toMatchObject({
      decision: 'opaque-fallback',
      requestedIntent: 'liquid-glass',
      fallback: { fill: data.finalStyle.fill, foreground: data.finalStyle.foreground },
      preserveStyle: false,
      selectedBackend: null,
      selectedProfile: null,
      effectiveMotion: null,
      diagnostics: ['style-tint-unavailable'],
    });
  });

  const malformedFacts: unknown[] = [
    undefined,
    null,
    false,
    true,
    'regular',
    1,
    {},
    { 0: 'regular', length: 1 },
    new Set(['regular']),
    [],
    ['unknown'],
    ['regular', 'unknown'],
    ['regular', undefined],
    ['regular', null],
    ['regular', ['clear']],
    Array(1),
    Object.assign(['regular'], { extra: true }),
    Object.assign(['regular'], { [Symbol('extra')]: true }),
    Object.defineProperty(['regular'], '0', { enumerable: false }),
    Object.setPrototypeOf(['regular'], null),
  ];

  it.each(malformedFacts.map((fact, index) => [index, fact] as const))(
    'fails closed on malformed capability %s without affecting untinted candidates',
    (_, styleTintVariants) => {
      const data = tinted();
      const provider = { ...data.provider!, styleTintVariants } as MaterialPolicyInput['provider'];
      expect(resolveMaterialPolicy({ ...data, provider })).toMatchObject({
        decision: 'opaque-fallback',
        selectedBackend: null,
        diagnostics: ['style-tint-unavailable'],
      });
      const untinted = input();
      expect(resolveMaterialPolicy({ ...untinted, provider })).toEqual(
        resolveMaterialPolicy(untinted)
      );
    }
  );

  it('rejects capability getters, element getters and inherited facts without executing them', () => {
    let reads = 0;
    const get = () => {
      reads++;
      throw new Error('must not run');
    };
    const data = input();
    const providers = [
      Object.defineProperty({ ...data.provider! }, 'styleTintVariants', { enumerable: true, get }),
      {
        ...data.provider!,
        styleTintVariants: Object.defineProperty(['regular'], '0', { enumerable: true, get }),
      },
      Object.assign(Object.create({ styleTintVariants: ['regular'] }), data.provider),
      Object.defineProperty({ ...data.provider! }, 'styleTintVariants', { value: ['regular'] }),
    ];
    for (const provider of providers) {
      expect(resolveMaterialPolicy({ ...tinted(), provider })).toMatchObject({
        decision: 'opaque-fallback',
        diagnostics: ['style-tint-unavailable'],
      });
      expect(resolveMaterialPolicy({ ...data, provider })).toEqual(resolveMaterialPolicy(data));
    }
    expect(reads).toBe(0);
  });

  it('contains a throwing reflection trap in the optional fact as a fallback diagnostic', () => {
    const data = tinted();
    const styleTintVariants = new Proxy(['regular'], {
      ownKeys() {
        throw new Error('provider fact unavailable');
      },
    }) as readonly 'regular'[];
    expect(
      resolveMaterialPolicy({ ...data, provider: { ...data.provider!, styleTintVariants } })
    ).toMatchObject({ decision: 'opaque-fallback', diagnostics: ['style-tint-unavailable'] });
  });

  it.each(['reduce', 'unknown'] as const)(
    'retains explicitly supported static tint under %s motion',
    (reducedMotion) => {
      const data = tinted();
      expect(
        resolveMaterialPolicy({
          ...data,
          candidates: [
            {
              intent: 'liquid-glass',
              tint: 'style-fill',
              deformation: { kind: 'press', phase: 'pressed', contact: 'pointer' },
            },
          ],
          preferences: { ...data.preferences, reducedMotion },
        })
      ).toMatchObject({
        decision: 'eligible',
        effectiveMotion: 'static',
        diagnostics: [],
        overrides: [reducedMotion === 'reduce' ? 'reduced-motion' : 'unknown-motion'],
      });
    }
  );

  it('leaves every existing guard and diagnostic ahead of unavailable tint', () => {
    const data = { ...tinted(), provider: input().provider };
    const cases: Array<[Partial<MaterialPolicyInput>, string]> = [
      [{ finalStyle: { ...data.finalStyle, fill: null } }, 'unresolved-owned-opaque-fallback'],
      [{ candidates: [] }, 'no-active-material-candidate'],
      [{ candidates: [data.candidates[0], data.candidates[0]] }, 'material-candidate-conflict'],
      [
        { candidates: [{ intent: 'liquid-glass', tint: 'unknown' } as never] },
        'invalid-material-candidate',
      ],
      [
        { preferences: { ...data.preferences, reducedTransparency: 'unknown' } },
        'transparency-or-contrast-override',
      ],
      [
        { preferences: { ...data.preferences, reducedTransparency: 'reduce' } },
        'transparency-or-contrast-override',
      ],
      [
        { preferences: { ...data.preferences, forcedColors: 'active' } },
        'transparency-or-contrast-override',
      ],
      [
        { preferences: { ...data.preferences, contrast: 'more' } },
        'transparency-or-contrast-override',
      ],
      [{ source: null }, 'source-lease-unavailable-or-mismatched'],
      [{ source: { ...data.source!, sameScope: false } }, 'source-lease-unavailable-or-mismatched'],
      [{ provider: null }, 'provider-unavailable-or-mismatched'],
      [{ provider: { ...data.provider!, ready: false } }, 'provider-unavailable-or-mismatched'],
      [{ provider: { ...data.provider!, backend: 'system-native' } }, 'intent-backend-mismatch'],
      [{ provider: { ...data.provider!, staticSupported: false } }, 'static-material-unavailable'],
      [
        {
          candidates: [
            {
              intent: 'liquid-glass',
              tint: 'style-fill',
              deformation: { kind: 'press', phase: 'rest' },
            },
          ],
          provider: { ...data.provider!, pressDeformationSupported: false },
        },
        'press-deformation-unavailable',
      ],
      [{ provider: { ...data.provider!, variants: [] } }, 'material-parameters-unavailable'],
      [{ geometry: { ...data.geometry, width: 0 } }, 'geometry-or-provider-budget-unavailable'],
      [
        { provider: { ...data.provider!, maxSurfacePixels: 1 } },
        'geometry-or-provider-budget-unavailable',
      ],
    ];
    for (const [change, diagnostic] of cases) {
      const result = resolveMaterialPolicy({ ...data, ...change });
      expect(result.diagnostics, diagnostic).toEqual([diagnostic]);
      expect(result.selectedBackend, diagnostic).toBeNull();
    }
  });

  it('does not let provider capability rescue tint on adaptive blur or unknown candidate fields', () => {
    const data = tinted();
    for (const candidate of [
      { intent: 'adaptive-blur', tint: 'style-fill' },
      { intent: 'liquid-glass', tint: 'style-fill', extra: true },
      { intent: 'liquid-glass', tint: 'style-fill', styleTintVariants: ['regular'] },
    ]) {
      expect(
        resolveMaterialPolicy({ ...data, candidates: [candidate] } as MaterialPolicyInput)
      ).toMatchObject({ decision: 'opaque-fallback', diagnostics: ['invalid-material-candidate'] });
    }
  });
});
