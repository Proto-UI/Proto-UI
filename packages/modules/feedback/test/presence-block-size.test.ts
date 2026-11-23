import { describe, expect, it } from 'vitest';
import {
  tw,
  type PresentationOwnerRef,
  type PresentationOutcome,
  type PresentationViewBinding,
} from '@proto.ui/core';
import {
  createPresencePresentationProjector,
  type PresenceEnvironment,
  type PresenceSample,
} from '../src/presence/projector';
import type { PresencePresentationFrame } from '../src/presence/sink';
import { cubicProgress } from '../src/motion/sampler';

const ease = [0.25, 0.1, 0.25, 1] as const;
function fixture() {
  let now = 0,
    ticket = 0,
    revision = 0,
    releases = 0;
  let invalidate = () => {};
  let accept = true;
  const scheduled = new Map<number, () => void>();
  const samples: PresenceSample[] = [];
  const outcomes: PresentationOutcome[] = [];
  const env: { value: PresenceEnvironment } = {
    value: {
      preference: 'no-preference',
      visible: true,
      width: 200,
      height: 120,
      rootFontPx: 16,
      intrinsicBlockSize: 120,
      supported: ['blockSize'],
    },
  };
  const binding = Object.freeze({}) as PresentationViewBinding;
  const owner = Object.freeze({}) as PresentationOwnerRef;
  const sink = createPresencePresentationProjector({
    binding,
    now: () => now,
    environment: () => env.value,
    subscribe: (callback) => {
      invalidate = callback;
      return () => {
        invalidate = () => {};
      };
    },
    requestFrame: (callback) => {
      scheduled.set(++ticket, callback);
      return ticket;
    },
    cancelFrame: (id) => {
      scheduled.delete(id as number);
    },
    project(_style, sample, current) {
      if (!current() || !accept) return false;
      samples.push(sample);
      return true;
    },
    release() {
      releases++;
    },
  });
  function commit(
    phase: 'entering' | 'entered' | 'leaving' = 'entering',
    overrides: Partial<PresencePresentationFrame> = {}
  ) {
    const frame: PresencePresentationFrame = {
      view: 1,
      revision: ++revision,
      targetRevision: 1,
      style: tw('block'),
      owner: {
        owner,
        revision,
        phase,
        attempt: phase === 'entered' ? null : { ownerEpoch: 1, phaseAttempt: revision },
        completion: 'presentation',
        durationMs: 350,
        timeoutMs: 1000,
      },
      closed: { blockSize: 0 },
      entered: { blockSize: 'intrinsic' },
      easing: ease,
      bind() {},
      complete: (_binding, outcome) => outcomes.push(outcome),
      ...overrides,
    };
    sink.commit(frame);
    return frame;
  }
  function at(time: number) {
    now = time;
    const frames = [...scheduled.values()];
    scheduled.clear();
    for (const frame of frames) frame();
  }
  return {
    sink,
    commit,
    at,
    samples,
    outcomes,
    env,
    scheduled,
    invalidate: () => invalidate(),
    releases: () => releases,
    reject: () => {
      accept = false;
    },
  };
}

describe('intrinsic block-size presence extension', () => {
  it('acknowledges actual zero before using the pinned 350ms ease and restores natural layout', () => {
    const f = fixture();
    f.commit();
    expect(f.samples.at(-1)).toEqual({ blockSize: 0 });
    f.at(16);
    expect(f.samples.at(-1)).toEqual({ blockSize: 0 });
    f.at(191);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(120 * cubicProgress(0.5, ease), 8);
    f.at(366);
    expect(f.samples.at(-1)).toEqual({ blockSize: 120 });
    expect(f.outcomes).toEqual(['finished']);
    expect(f.scheduled.size).toBe(0);
    expect(f.releases()).toBe(1);
  });
  it('initial entered applies semantic size directly without a synthetic animation', () => {
    const f = fixture();
    f.commit('entered');
    expect(f.samples.filter((sample) => sample.blockSize !== undefined)).toEqual([
      { blockSize: 120 },
    ]);
    expect(f.outcomes).toEqual([]);
    expect(f.scheduled.size).toBe(0);
    expect(f.releases()).toBe(1);
  });
  it.each([50, 260])('retargets intrinsic changes to %s from the last accepted sample', (size) => {
    const f = fixture();
    f.commit();
    f.at(16);
    f.at(116);
    const displayed = f.samples.at(-1)?.blockSize;
    f.env.value = { ...f.env.value, intrinsicBlockSize: size };
    f.invalidate();
    expect(f.samples.at(-1)?.blockSize).toBe(displayed);
    f.at(466);
    expect(f.samples.at(-1)?.blockSize).toBe(size);
    expect(f.outcomes).toEqual(['finished']);
  });
  it('reverses from the last displayed size and shortens the return without a jump', () => {
    const f = fixture();
    f.commit();
    f.at(16);
    f.at(191);
    const displayed = f.samples.at(-1)?.blockSize;
    f.commit('leaving');
    expect(f.samples.at(-1)?.blockSize).toBe(displayed);
    f.at(541);
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    expect(f.outcomes).toEqual(['finished']);
  });
  it.each(['reduce', 'unknown'] as const)(
    'settles %s preference without scheduled interpolation',
    (preference) => {
      const f = fixture();
      f.env.value = { ...f.env.value, preference };
      f.commit();
      expect(f.samples.at(-1)?.blockSize).toBe(120);
      expect(f.scheduled.size).toBe(0);
      expect(f.outcomes).toEqual([
        preference === 'reduce' ? 'reduced-motion' : 'unknown-preference',
      ]);
    }
  );
  it('does not replace unavailable intrinsic input with scroll extent or a guessed size', () => {
    const f = fixture();
    f.env.value = { ...f.env.value, intrinsicBlockSize: null };
    f.commit();
    expect(f.samples.every((sample) => sample.blockSize === undefined)).toBe(true);
    expect(f.scheduled.size).toBe(0);
    expect(f.outcomes).toEqual(['projection-failed']);
  });
  it('keeps arbitrary block-size profiles unsupported before transient writes', () => {
    const f = fixture();
    f.commit('entering', { entered: { blockSize: 300 } });
    expect(f.samples.every((sample) => sample.blockSize === undefined)).toBe(true);
    expect(f.outcomes).toEqual(['unsupported-endpoint']);
    expect(f.scheduled.size).toBe(0);
  });
  it('retirement makes even a retained old frame callback inert', () => {
    const f = fixture();
    f.commit();
    const stale = [...f.scheduled.values()];
    f.sink.release(1);
    const count = f.samples.length;
    stale.forEach((callback) => callback());
    expect(f.samples).toHaveLength(count);
    expect(f.outcomes).toEqual([]);
    expect(f.scheduled.size).toBe(0);
  });
  it('projection loss and deadline settle once without leaving scheduled work', () => {
    const f = fixture();
    f.commit();
    f.at(16);
    f.reject();
    f.at(32);
    expect(f.outcomes).toEqual(['projection-failed']);
    expect(f.scheduled.size).toBe(0);
    f.sink.settle('deadline');
    expect(f.outcomes).toEqual(['projection-failed']);
  });
});
