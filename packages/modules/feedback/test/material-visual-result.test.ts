import { describe, expect, it, vi } from 'vitest';
import {
  resolveVisualResult,
  createVisualTransactionGate,
  type VisualInput,
} from '../src/material/visual-result';

function input(): VisualInput {
  return {
    stamp: {
      target: 1,
      source: 1,
      surface: 'surface-a',
      binding: 1,
      view: 1,
      geometry: 1,
      frame: 1,
    },
    style: {
      tokens: ['rounded-full', 'text-foreground'],
      provenance: 'post-patch-complete',
      paint: [],
      foreground: [0, 0, 0, 1],
    },
    geometry: { width: 146, height: 60, radius: 9999, dpr: 1, axisAligned: true },
    slot: {
      fallback: { fill: [1, 1, 1, 1], foreground: [0, 0, 0, 1] },
      candidates: [
        {
          kind: 'refractive',
          version: 1,
          model: 'heightfield-v1',
          variant: 'regular',
          phase: 'rest',
          anchor: 'center',
        },
      ],
    },
    support: true,
    preferences: {
      reducedMotion: 'no-preference',
      reducedTransparency: 'no-preference',
      contrast: 'no-preference',
      forcedColors: 'none',
    },
  };
}

describe('experimental final material visual resolver', () => {
  it('resolves one complete candidate and one shared clamped geometry', () => {
    const source = input();
    const result = resolveVisualResult(source);
    expect(result.material?.quality).toBe('portable-model');
    expect(result.geometry?.radius).toBe(30);
    source.style.tokens.push('bg-red-500');
    expect(result.style.tokens).toEqual(['rounded-full', 'text-foreground']);
  });
  it('distinguishes zero candidates from slot removal and explicitly restores style', () => {
    const source = input();
    source.slot!.candidates = [];
    expect(resolveVisualResult(source).material?.quality).toBe('opaque-fallback');
    source.slot = null;
    source.style.paint = [{ channel: 'fill', tokens: ['bg-background'] }];
    source.style.tokens.push('bg-background');
    const removed = resolveVisualResult(source);
    expect(removed.material).toBeNull();
    expect(removed.style.tokens).toContain('bg-background');
    expect(removed.diagnostics).toEqual([]);
  });
  it('multiple or malformed whole candidates fall back without implicit precedence', () => {
    const source = input();
    source.slot!.candidates.push({ ...source.slot!.candidates[0], phase: 'pressed' });
    expect(resolveVisualResult(source).diagnostics).toContain('material-candidate-conflict');
    source.slot!.candidates = [{ ...source.slot!.candidates[0], shader: 'url(unsafe)' } as any];
    const invalid = resolveVisualResult(source);
    expect(invalid.material?.quality).toBe('opaque-fallback');
    expect(invalid.diagnostics).toContain('invalid-material-candidate');
  });
  it('checks post-patch paint ownership and rejects unresolved selector provenance', () => {
    for (const paint of ['fill', 'background-image', 'backdrop', 'coat'] as const) {
      const source = input();
      source.style.tokens.push('owned-paint');
      source.style.paint = [{ channel: paint, tokens: ['owned-paint'] }];
      expect(resolveVisualResult(source).diagnostics).toContain('conflicting-authored-paint');
    }
    const source = input();
    source.style.provenance = 'selector-dependent';
    expect(resolveVisualResult(source).diagnostics).toContain('unresolved-style-provenance');
  });
  it('unsafe or unknown preferences and unsupported profiles never enhance', () => {
    for (const key of [
      'reducedMotion',
      'reducedTransparency',
      'contrast',
      'forcedColors',
    ] as const) {
      const source = input();
      source.preferences[key] = 'unknown';
      expect(resolveVisualResult(source).material?.quality).toBe('opaque-fallback');
    }
    const source = input();
    source.support = 'unknown';
    expect(resolveVisualResult(source).diagnostics).toContain('material-support-unavailable');
    source.geometry.axisAligned = false;
    expect(resolveVisualResult(source).diagnostics).toContain('geometry-unavailable');
  });
  it('bounds allocation and rejects missing opaque palette rather than inventing fallback', () => {
    const source = input();
    source.geometry.width = 4096;
    source.geometry.height = 4096;
    expect(resolveVisualResult(source).material?.quality).toBe('opaque-fallback');
    source.slot!.fallback.fill = [1, 1, 1, 0.5] as any;
    expect(() => resolveVisualResult(source)).toThrow('opaque fallback palette');
  });
});

describe('pure visual transaction resource state machine, not host paint evidence', () => {
  it('commits complete snapshots and releases the previous resource only after replacement', () => {
    const log: string[] = [];
    const gate = createVisualTransactionGate((snapshot) =>
      log.push(snapshot.material?.quality ?? 'removed')
    );
    const first = gate.begin(resolveVisualResult(input()));
    const releaseFirst = vi.fn(() => log.push('release-first'));
    expect(gate.complete(first, { release: releaseFirst })).toBe(true);
    const next = input();
    next.stamp.target++;
    const ticket = gate.begin(resolveVisualResult(next));
    expect(releaseFirst).not.toHaveBeenCalled();
    gate.complete(ticket, { release: vi.fn() });
    expect(log).toEqual(['opaque-fallback', 'portable-model', 'portable-model', 'release-first']);
  });
  it('retires stale target/source/surface/geometry/frame completions independently', () => {
    for (const key of [
      'target',
      'source',
      'view',
      'binding',
      'surface',
      'geometry',
      'frame',
    ] as const) {
      const gate = createVisualTransactionGate(vi.fn());
      const old = gate.begin(resolveVisualResult(input()));
      const newer = input();
      if (key === 'surface') {
        newer.stamp.surface = 'surface-b';
        newer.stamp.binding++;
      } else newer.stamp[key]++;
      gate.begin(resolveVisualResult(newer));
      const resource = { release: vi.fn() };
      expect(gate.complete(old, resource)).toBe(false);
      expect(resource.release).toHaveBeenCalledOnce();
    }
  });
  it('source loss immediately commits authored fallback and cannot resurrect pending optics', () => {
    const commits: string[] = [];
    const gate = createVisualTransactionGate((x) => commits.push(x.material?.quality ?? 'removed'));
    const pending = gate.begin(resolveVisualResult(input()));
    gate.sourceLost(2);
    const resource = { release: vi.fn() };
    expect(gate.complete(pending, resource)).toBe(false);
    expect(commits).toEqual(['opaque-fallback', 'opaque-fallback']);
    expect(resource.release).toHaveBeenCalledOnce();
  });
  it('slot tombstone and disposal release resources once without a lingering fallback owner', () => {
    const commits: Array<string | null> = [];
    const release = vi.fn();
    const gate = createVisualTransactionGate((x) => commits.push(x.material?.quality ?? null));
    gate.complete(gate.begin(resolveVisualResult(input())), { release });
    const removed = input();
    removed.slot = null;
    removed.stamp.target++;
    gate.begin(resolveVisualResult(removed));
    expect(commits).toEqual(['opaque-fallback', 'portable-model', null]);
    expect(release).toHaveBeenCalledOnce();
    gate.dispose();
    gate.dispose();
    expect(release).toHaveBeenCalledOnce();
    expect(() => gate.begin(resolveVisualResult(input()))).toThrow('disposed');
  });
  it('a failed resource preparation commits fallback and a reused ticket cannot publish twice', () => {
    const commits: string[] = [];
    const gate = createVisualTransactionGate((x) => commits.push(x.material?.quality ?? 'removed'));
    const ticket = gate.begin(resolveVisualResult(input()));
    gate.fail(ticket);
    const late = { release: vi.fn() };
    expect(gate.complete(ticket, late)).toBe(false);
    expect(commits).toEqual(['opaque-fallback', 'opaque-fallback']);
    expect(late.release).toHaveBeenCalledOnce();
  });
});

describe('reentrant publication and monotonic source recovery', () => {
  it('a synchronous source loss during commit cannot retain the revoked resource', () => {
    let gate: ReturnType<typeof createVisualTransactionGate>;
    gate = createVisualTransactionGate((x) => {
      if (x.material?.quality === 'portable-model') gate.sourceLost(2);
    });
    const release = vi.fn();
    gate.complete(gate.begin(resolveVisualResult(input())), { release });
    expect(gate.inspect().hasResource).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
  it('recovery cannot reuse an older source generation or a stale same-geometry frame', () => {
    const gate = createVisualTransactionGate(vi.fn());
    gate.begin(resolveVisualResult(input()));
    gate.sourceLost(2);
    expect(() => gate.begin(resolveVisualResult(input()))).toThrow('stale');
    const current = input();
    current.stamp.source = 3;
    gate.begin(resolveVisualResult(current));
    expect(() => gate.begin(resolveVisualResult(current))).toThrow('stale');
  });
});

it('dispose during publication wins over the outer resource commit', () => {
  let gate: ReturnType<typeof createVisualTransactionGate>;
  gate = createVisualTransactionGate((x) => {
    if (x.material?.quality === 'portable-model') gate.dispose();
  });
  const resource = { release: vi.fn() };
  gate.complete(gate.begin(resolveVisualResult(input())), resource);
  expect(gate.inspect()).toEqual({ disposed: true, pending: false, hasResource: false });
  expect(resource.release).toHaveBeenCalledOnce();
});
it('host commit failure preserves the last owned resource and releases the rejected replacement', () => {
  let reject = false;
  const gate = createVisualTransactionGate(() => {
    if (reject) throw new Error('commit-failed');
  });
  const old = { release: vi.fn() },
    next = { release: vi.fn() };
  gate.complete(gate.begin(resolveVisualResult(input())), old);
  reject = true;
  const source = input();
  source.stamp.target++;
  const pending = gate.begin(resolveVisualResult(source));
  expect(() => gate.complete(pending, next)).toThrow('commit-failed');
  expect(old.release).not.toHaveBeenCalled();
  expect(next.release).toHaveBeenCalledOnce();
  expect(gate.inspect().hasResource).toBe(true);
});
it('rejects foreground/palette disagreement and preserves non-paint style on conflict fallback', () => {
  const source = input();
  source.slot!.fallback.foreground = [1, 1, 1, 1];
  expect(() => resolveVisualResult(source)).toThrow('opaque fallback palette');
  source.slot!.fallback.foreground = [0, 0, 0, 1];
  source.style.tokens.push('bg-background');
  source.style.paint = [{ channel: 'fill', tokens: ['bg-background'] }];
  const result = resolveVisualResult(source);
  expect(result.style.tokens).toEqual(['rounded-full', 'text-foreground']);
  expect(result.style.clearPaint).toContain('fill');
  expect(result.material?.quality).toBe('opaque-fallback');
});

it('publishes complete opaque output before first enhancement resources are ready', () => {
  const commits: string[] = [];
  const gate = createVisualTransactionGate((x) => commits.push(x.material?.quality ?? 'removed'));
  gate.begin(resolveVisualResult(input()));
  expect(commits).toEqual(['opaque-fallback']);
});

it('a retired resource object cannot be reused for a new target', () => {
  const gate = createVisualTransactionGate(vi.fn());
  const old = { release: vi.fn() };
  gate.complete(gate.begin(resolveVisualResult(input())), old);
  const tombstone = input();
  tombstone.slot = null;
  tombstone.stamp.target = 2;
  gate.begin(resolveVisualResult(tombstone));
  const newer = input();
  newer.stamp.target = 3;
  const ticket = gate.begin(resolveVisualResult(newer));
  expect(gate.complete(ticket, old)).toBe(false);
  expect(old.release).toHaveBeenCalledOnce();
  expect(gate.inspect().hasResource).toBe(false);
});
it('newer press target retires pending rest without interpreting or dispatching input', () => {
  const committed: unknown[] = [];
  const gate = createVisualTransactionGate((x) => committed.push(x.material?.candidate?.phase));
  const rest = gate.begin(resolveVisualResult(input()));
  const pressed = input();
  pressed.stamp.target = 2;
  pressed.slot!.candidates[0].phase = 'pressed';
  const next = gate.begin(resolveVisualResult(pressed));
  const old = { release: vi.fn() };
  expect(gate.complete(rest, old)).toBe(false);
  gate.complete(next, { release: vi.fn() });
  expect(committed.filter(Boolean)).toEqual(['pressed']);
  expect(old.release).toHaveBeenCalledOnce();
});

it('duplicate successful completion cannot release the current committed resource', () => {
  const gate = createVisualTransactionGate(vi.fn());
  const resource = { release: vi.fn() };
  const ticket = gate.begin(resolveVisualResult(input()));
  expect(gate.complete(ticket, resource)).toBe(true);
  expect(gate.complete(ticket, resource)).toBe(false);
  expect(resource.release).not.toHaveBeenCalled();
  expect(gate.inspect().hasResource).toBe(true);
  gate.dispose();
  expect(resource.release).toHaveBeenCalledOnce();
});

it('a new target cannot make an older frame from the same lease current', () => {
  const gate = createVisualTransactionGate(vi.fn());
  const a = input();
  a.stamp.frame = 5;
  gate.begin(resolveVisualResult(a));
  const b = input();
  b.stamp.target = 2;
  expect(() => gate.begin(resolveVisualResult(b))).toThrow('stale');
});
it('failed recommit of the current resource does not release that restored owner', () => {
  let reject = false;
  const gate = createVisualTransactionGate(() => {
    if (reject) throw new Error('commit-failed');
  });
  const resource = { release: vi.fn() };
  gate.complete(gate.begin(resolveVisualResult(input())), resource);
  const next = input();
  next.stamp.target++;
  const ticket = gate.begin(resolveVisualResult(next));
  reject = true;
  expect(() => gate.complete(ticket, resource)).toThrow('commit-failed');
  expect(resource.release).not.toHaveBeenCalled();
  expect(gate.inspect().hasResource).toBe(true);
});
it('rejects sparse fallback colors and snapshots not produced by the resolver', () => {
  const source = input();
  const sparse = Array(4);
  sparse[3] = 1;
  source.slot!.fallback.fill = sparse as any;
  expect(() => resolveVisualResult(source)).toThrow('opaque fallback palette');
  const gate = createVisualTransactionGate(vi.fn());
  const forged = { ...resolveVisualResult(input()) } as any;
  delete forged.style;
  forged.stamp = { ...forged.stamp, view: NaN };
  expect(() => gate.begin(forged)).toThrow('unresolved visual snapshot');
});

it('surface rebind requires a new incarnation and cannot re-admit the retired binding', () => {
  const gate = createVisualTransactionGate(vi.fn());
  gate.begin(resolveVisualResult(input()));
  const b = input();
  b.stamp.surface = 'surface-b';
  b.stamp.binding = 2;
  gate.begin(resolveVisualResult(b));
  const old = input();
  old.stamp.target = 2;
  expect(() => gate.begin(resolveVisualResult(old))).toThrow('stale');
  old.stamp.binding = 3;
  expect(() => gate.begin(resolveVisualResult(old))).not.toThrow();
});
it('a failing reentrant loss commit cannot retain a revoked resource', () => {
  let gate: ReturnType<typeof createVisualTransactionGate>;
  let portable = false;
  gate = createVisualTransactionGate((x) => {
    if (x.material?.quality === 'portable-model') {
      portable = true;
      gate.sourceLost(2);
    } else if (portable) throw new Error('fallback-failed');
  });
  const resource = { release: vi.fn() };
  const ticket = gate.begin(resolveVisualResult(input()));
  expect(() => gate.complete(ticket, resource)).toThrow('fallback-failed');
  expect(gate.inspect().hasResource).toBe(false);
  expect(resource.release).toHaveBeenCalledOnce();
});

it('a resolved snapshot cannot contain sparse style/provenance arrays or malformed candidate lists', () => {
  const sparse = input();
  sparse.style.tokens = Array(1);
  expect(() => resolveVisualResult(sparse)).toThrow('Invalid final authored style');
  const contribution = input();
  contribution.style.paint = [{ channel: 'fill', tokens: Array(1) }];
  expect(() => resolveVisualResult(contribution)).toThrow('Invalid post-patch paint provenance');
  const malformed = input();
  malformed.slot!.candidates = {} as any;
  expect(resolveVisualResult(malformed).material?.quality).toBe('opaque-fallback');
});
