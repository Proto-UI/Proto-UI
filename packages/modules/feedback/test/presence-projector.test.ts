import { describe, expect, it } from 'vitest';
import {
  tw,
  type PresentationOwnerRef,
  type PresentationViewBinding,
  type PresentationOutcome,
} from '@proto.ui/core';
import {
  createPresencePresentationProjector,
  type PresenceEnvironment,
} from '../src/presence/projector';
import { cubicProgress } from '../src/motion/sampler';
import type { PresencePresentationFrame } from '../src/presence/sink';
const zero = { px: 0, rootText: 0, ownBox: 0 };
function fixture() {
  let now = 0,
    nextTicket = 0;
  let invalidate = () => {};
  const frames = new Map<number, () => void>();
  const samples: Array<{ time: number; translate?: readonly [number, number]; opacity?: number }> =
    [];
  const results: PresentationOutcome[] = [];
  const env: { value: PresenceEnvironment } = {
    value: {
      preference: 'no-preference',
      visible: true,
      width: 320,
      height: 200,
      rootFontPx: 16,
      supported: ['translate', 'opacity'],
    },
  };
  const binding = Object.freeze({}) as PresentationViewBinding;
  let project: (() => boolean) | null = null;
  let onCancel: (() => void) | null = null;
  let releases = 0;
  const sink = createPresencePresentationProjector({
    binding,
    now: () => now,
    environment: () => env.value,
    subscribe: (callback) => {
      invalidate = callback;
      return () => {};
    },
    requestFrame: (callback) => {
      const ticket = ++nextTicket;
      frames.set(ticket, callback);
      return ticket;
    },
    cancelFrame: (ticket) => {
      frames.delete(ticket as number);
      const callback = onCancel;
      onCancel = null;
      callback?.();
    },
    project: (_style, sample, current) => {
      if (!current()) return false;
      if (project && !project()) return false;
      samples.push({ time: now, ...sample });
      return true;
    },
    release() {
      releases++;
    },
  });
  const owner = Object.freeze({}) as PresentationOwnerRef;
  let revision = 0;
  const commit = (options: Partial<PresencePresentationFrame['owner']> = {}) => {
    const frame: PresencePresentationFrame = {
      view: 1,
      targetRevision: 1,
      revision: ++revision,
      style: tw('bg-background'),
      owner: {
        owner,
        revision,
        phase: 'entering',
        attempt: { ownerEpoch: 1, phaseAttempt: 1 },
        completion: 'presentation',
        durationMs: 500,
        timeoutMs: 1000,
        ...options,
      },
      closed: { translate: [zero, { ...zero, ownBox: 1 }], opacity: 0 },
      entered: { translate: [zero, zero], opacity: 1 },
      easing: [0.32, 0.72, 0, 1],
      bind() {},
      complete: (_binding, outcome) => results.push(outcome),
    };
    sink.commit(frame);
    return frame;
  };
  const frameAt = (time: number) => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb();
  };
  return {
    sink,
    commit,
    frameAt,
    samples,
    results,
    frames,
    env,
    invalidate: () => invalidate(),
    setProject: (next: () => boolean) => {
      project = next;
    },
    setCancel: (next: () => void) => {
      onCancel = next;
    },
    releases: () => releases,
  };
}
describe('neutral presence presentation', () => {
  it('cold entry uses own-box initial frame then the pinned duration/easing', () => {
    const f = fixture();
    f.commit();
    expect(f.samples.at(-1)?.translate).toEqual([0, 200]);
    expect(f.results).toEqual([]);
    f.frameAt(16);
    expect(f.samples.at(-1)?.translate).toEqual([0, 200]);
    f.frameAt(266);
    const p = cubicProgress(0.5, [0.32, 0.72, 0, 1]);
    expect(f.samples.at(-1)?.translate?.[1]).toBeCloseTo(200 * (1 - p), 8);
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(p, 8);
    f.frameAt(516);
    expect(f.samples.at(-1)?.translate).toEqual([0, 0]);
    expect(f.results).toEqual(['finished']);
    expect(f.frames.size).toBe(0);
  });
  it('initial entered does not synthesize a cold offset or clock', () => {
    const f = fixture();
    f.commit({ phase: 'entered', attempt: null });
    expect(f.samples.at(-1)?.translate).toEqual([0, 0]);
    expect(f.frames.size).toBe(0);
    expect(f.results).toEqual([]);
  });
  it('leave then reopen anchors to the last displayed sample', () => {
    const f = fixture();
    f.commit({ phase: 'entered', attempt: null });
    f.commit({ phase: 'leaving', attempt: { ownerEpoch: 1, phaseAttempt: 2 } });
    f.frameAt(100);
    const y = f.samples.at(-1)!.translate![1];
    expect(y).toBeGreaterThan(0);
    f.commit({ phase: 'entering', attempt: { ownerEpoch: 1, phaseAttempt: 3 } });
    expect(f.samples.at(-1)?.translate?.[1]).toBe(y);
    f.frameAt(600);
    expect(f.samples.at(-1)?.translate).toEqual([0, 0]);
    expect(f.results).toEqual(['finished']);
  });
  it.each(['reduce', 'unknown'] as const)('settles %s immediately without a RAF', (preference) => {
    const f = fixture();
    f.env.value = { ...f.env.value, preference };
    f.commit();
    expect(f.samples.at(-1)?.translate).toEqual([0, 0]);
    expect(f.frames.size).toBe(0);
    expect(f.results).toEqual([preference === 'reduce' ? 'reduced-motion' : 'unknown-preference']);
  });
  it('zero duration and invalid timeout settle without frame wait', () => {
    for (const durationMs of [0, 1000, 1500]) {
      const f = fixture();
      f.commit({ durationMs });
      expect(f.frames.size).toBe(0);
      expect(f.results).toEqual([durationMs === 0 ? 'zero-duration' : 'invalid-policy']);
    }
  });
  it('same target updates do not restart motion', () => {
    const f = fixture();
    f.commit();
    f.frameAt(16);
    f.frameAt(100);
    const sample = f.samples.at(-1)?.translate?.[1];
    f.commit();
    expect(f.samples.at(-1)?.translate?.[1]).toBe(sample);
    f.frameAt(516);
    expect(f.results).toEqual(['finished']);
  });
  it('reentrant dispose in projection rejects endpoint completion', () => {
    const f = fixture();
    f.commit();
    f.frameAt(16);
    f.setProject(() => {
      f.sink.release(1);
      return true;
    });
    f.frameAt(516);
    expect(f.results).toEqual([]);
    expect(f.frames.size).toBe(0);
  });
  it('failed projection completes failure without scheduling indefinitely', () => {
    const f = fixture();
    f.setProject(() => false);
    f.commit();
    expect(f.results).toEqual(['projection-failed']);
    expect(f.frames.size).toBe(0);
  });
  it('visibility loss settles once and visibility return does not replay', () => {
    const f = fixture();
    f.commit();
    f.frameAt(16);
    f.env.value = { ...f.env.value, visible: false };
    f.invalidate();
    expect(f.results).toEqual(['hidden']);
    f.env.value = { ...f.env.value, visible: true };
    f.invalidate();
    expect(f.frames.size).toBe(0);
    expect(f.results).toEqual(['hidden']);
  });
});
it.each(['entered', 'entering'] as const)(
  'nonneutral entered endpoint receives explicit unsupported diagnostic in %s',
  (phase) => {
    const f = fixture();
    const frame = f.commit({
      phase,
      attempt: phase === 'entered' ? null : { ownerEpoch: 1, phaseAttempt: 2 },
    });
    f.sink.cancel();
    f.sink.commit({ ...frame, entered: { translate: [zero, { ...zero, px: 12 }], opacity: 1 } });
    expect(f.sink.diagnostics?.()).toContain('unsupported-endpoint');
    expect(f.frames.size).toBe(0);
    if (phase === 'entering') expect(f.results.at(-1)).toBe('unsupported-endpoint');
  }
);

it('dispose during frame cancellation prevents replacement work', () => {
  const f = fixture();
  f.commit();
  f.setCancel(() => f.sink.release(1));
  f.commit({ phase: 'leaving', attempt: { ownerEpoch: 1, phaseAttempt: 2 } });
  expect(f.frames.size).toBe(0);
  expect(f.results).toEqual([]);
});
it('newer commit during cancellation wins over the outer replacement', () => {
  const f = fixture();
  f.commit();
  f.setCancel(() => f.commit({ phase: 'entering', attempt: { ownerEpoch: 1, phaseAttempt: 3 } }));
  f.commit({ phase: 'leaving', attempt: { ownerEpoch: 1, phaseAttempt: 2 } });
  f.frameAt(16);
  f.frameAt(516);
  expect(f.samples.at(-1)?.translate).toEqual([0, 0]);
  expect(f.results).toEqual(['finished']);
});
it('public cancellation does not clear a reentrant replacement', () => {
  const f = fixture();
  f.commit();
  f.setCancel(() => f.commit({ phase: 'entering', attempt: { ownerEpoch: 1, phaseAttempt: 3 } }));
  f.sink.cancel();
  f.frameAt(16);
  f.frameAt(516);
  expect(f.samples.at(-1)?.translate).toEqual([0, 0]);
  expect(f.results).toEqual(['finished']);
});
it('settled invalidations withdraw all transient leases each time', () => {
  const f = fixture();
  f.commit();
  f.frameAt(16);
  f.frameAt(516);
  const releases = f.releases();
  f.commit({ phase: 'entered', attempt: null });
  f.invalidate();
  expect(f.releases()).toBe(releases + 2);
  expect(f.frames.size).toBe(0);
});

it('unsupported endpoint fallback cannot release a reentrant supported projection', () => {
  const f = fixture();
  const frame = f.commit();
  f.sink.cancel();
  let nested = false;
  f.setProject(() => {
    if (!nested) {
      nested = true;
      f.commit({ phase: 'entering', attempt: { ownerEpoch: 1, phaseAttempt: 3 } });
    }
    return true;
  });
  const releases = f.releases();
  f.sink.commit({ ...frame, entered: { opacity: 0.5, translate: [zero, zero] } });
  expect(f.releases()).toBe(releases);
  f.frameAt(16);
  f.frameAt(516);
  expect(f.results).toEqual(['finished']);
});
it('initial settled projection refusal is explicitly diagnosed', () => {
  const f = fixture();
  f.setProject(() => false);
  f.commit({ phase: 'entered', attempt: null });
  expect(f.sink.diagnostics?.()).toContain('projection-failed');
  expect(f.results).toEqual([]);
  expect(f.frames.size).toBe(0);
});

it('failed replacement target receives immediate failure after prior acknowledgement', () => {
  const f = fixture();
  const frame = f.commit();
  f.frameAt(16);
  f.frameAt(516);
  f.setProject(() => false);
  f.sink.commit({
    ...frame,
    revision: 2,
    targetRevision: 2,
    closed: { translate: [zero, { ...zero, ownBox: -1 }], opacity: 0 },
  });
  expect(f.results).toEqual(['finished', 'projection-failed']);
  expect(f.frames.size).toBe(0);
});
