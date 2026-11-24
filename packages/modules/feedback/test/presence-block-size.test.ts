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
  let onRelease: (() => void) | undefined;
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
      onRelease?.();
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
    onRelease: (callback?: () => void) => {
      onRelease = callback;
    },
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
  it('animates the first close of initially visible content without a prior presentation frame', () => {
    const f = fixture();
    // Initial open without appear is semantic natural layout. Some renderers
    // do not publish a presentation frame until the first actual transition.
    f.commit('leaving');
    expect(f.outcomes).toEqual([]);
    expect(f.scheduled.size).toBe(1);
    f.at(175);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(120 * (1 - cubicProgress(0.5, ease)), 8);
    expect(f.outcomes).toEqual([]);
    f.at(350);
    expect(f.samples.at(-1)).toEqual({ blockSize: 0 });
    expect(f.outcomes).toEqual(['finished']);
    expect(f.scheduled.size).toBe(0);
    expect(f.releases()).toBe(1);
  });
  it.each([
    { initialSize: 0, visible: false },
    { initialSize: 20, visible: false },
    { initialSize: 120, visible: true },
  ])(
    'does not reuse the released initial $initialSize sample after semantic content grows',
    ({ initialSize, visible }) => {
      const f = fixture();
      f.env.value = { ...f.env.value, intrinsicBlockSize: initialSize, visible };
      f.commit('entered');
      expect(f.samples.at(-1)?.blockSize).toBe(initialSize);
      expect(f.releases()).toBe(1);

      // Children may arrive after the initial entered publication. Once the
      // transient lease is released, the semantic box owns its current size.
      f.env.value = { ...f.env.value, intrinsicBlockSize: 139, visible: true };
      const samples = f.samples.length;
      f.invalidate();
      expect(f.samples).toHaveLength(samples);
      f.commit('leaving');
      expect(f.outcomes).toEqual([]);
      expect(f.scheduled.size).toBe(1);
      f.at(175);
      expect(f.samples.at(-1)?.blockSize).toBeCloseTo(139 * (1 - cubicProgress(0.5, ease)), 8);
      f.at(350);
      expect(f.samples.at(-1)?.blockSize).toBe(0);
      expect(f.outcomes).toEqual(['finished']);
      expect(f.scheduled.size).toBe(0);
    }
  );
  it('starts a later leave at current semantic size after a completed animation releases its sampler', () => {
    const f = fixture();
    f.commit();
    f.at(16);
    f.at(366);
    expect(f.outcomes).toEqual(['finished']);
    expect(f.samples.at(-1)?.blockSize).toBe(120);
    f.env.value = { ...f.env.value, intrinsicBlockSize: 260 };
    f.invalidate();
    f.commit('leaving');
    expect(f.outcomes).toEqual(['finished']);
    f.at(541);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(260 * (1 - cubicProgress(0.5, ease)), 8);
    f.at(716);
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    expect(f.outcomes).toEqual(['finished', 'finished']);
  });
  it('obtains a fresh zero acknowledgement when reopening after terminal leave', () => {
    const f = fixture();
    f.commit('leaving');
    f.at(350);
    expect(f.outcomes).toEqual(['finished']);
    f.env.value = { ...f.env.value, intrinsicBlockSize: 80 };
    f.commit('entering');
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    f.at(366);
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    expect(f.outcomes).toEqual(['finished']);
    f.at(541);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(80 * cubicProgress(0.5, ease), 8);
    f.at(716);
    expect(f.samples.at(-1)?.blockSize).toBe(80);
    expect(f.outcomes).toEqual(['finished', 'finished']);
  });
  it('can leave from an accepted sample when fresh intrinsic input is unavailable', () => {
    const f = fixture();
    f.commit();
    f.at(16);
    f.at(191);
    const displayed = f.samples.at(-1)!.blockSize!;
    f.env.value = { ...f.env.value, intrinsicBlockSize: null };
    f.commit('leaving');
    expect(f.samples.at(-1)?.blockSize).toBe(displayed);
    expect(f.outcomes).toEqual([]);
    f.at(241);
    expect(f.samples.at(-1)!.blockSize!).toBeGreaterThan(0);
    expect(f.samples.at(-1)!.blockSize!).toBeLessThan(displayed);
    f.at(541);
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    expect(f.outcomes).toEqual(['finished']);
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

  it.each(['reduce', 'no-preference'] as const)(
    'does not reacquire a terminal endpoint during synchronous %s release notifications',
    (preference) => {
      const f = fixture();
      f.env.value = { ...f.env.value, preference };
      // Bound the deliberately reentrant host so the failing implementation
      // reports its repeated release instead of overflowing the test runner.
      f.onRelease(() => {
        if (f.releases() < 6) f.invalidate();
      });
      f.commit();
      if (preference === 'no-preference') {
        f.at(16);
        f.at(366);
      }
      expect(f.releases()).toBe(1);
      expect(f.outcomes).toEqual([preference === 'reduce' ? 'reduced-motion' : 'finished']);
      const samples = f.samples.length;
      f.invalidate();
      expect(f.sink.settle('deadline')).toBe(false);
      expect(f.samples).toHaveLength(samples);
      expect(f.releases()).toBe(1);
    }
  );

  it.each(['revision', 'attempt', 'target'] as const)(
    'publishes only the current %s receipt after a commit inside host release',
    (replacement) => {
      const f = fixture();
      const first = f.commit();
      const currentOutcomes: PresentationOutcome[] = [];
      f.onRelease(() => {
        f.onRelease();
        f.sink.commit({
          ...first,
          revision: first.revision + 1,
          targetRevision: first.targetRevision + (replacement === 'target' ? 1 : 0),
          owner: {
            ...first.owner,
            revision: first.owner.revision + 1,
            attempt: {
              ownerEpoch: 1,
              phaseAttempt: 1 + (replacement === 'attempt' ? 1 : 0),
            },
          },
          complete: (_binding, outcome) => currentOutcomes.push(outcome),
        });
      });
      f.env.value = { ...f.env.value, preference: 'reduce' };
      f.invalidate();
      expect(f.outcomes).toEqual([]);
      expect(currentOutcomes).toEqual(['reduced-motion']);
      expect(f.releases()).toBe(replacement === 'revision' ? 1 : 2);
      expect(f.scheduled.size).toBe(0);
    }
  );

  it('keeps completion reentry finite and leaves timer-mode terminal frames without a receipt', () => {
    const f = fixture();
    f.env.value = { ...f.env.value, preference: 'reduce' };
    const outcomes: PresentationOutcome[] = [];
    f.commit('entering', {
      complete: (_binding, outcome) => {
        outcomes.push(outcome);
        f.sink.settle('deadline');
        f.invalidate();
      },
    });
    expect(outcomes).toEqual(['reduced-motion']);
    expect(f.releases()).toBe(1);
    const timer = fixture();
    const initial = timer.commit('entered');
    timer.sink.commit({
      ...initial,
      revision: 2,
      owner: {
        ...initial.owner,
        revision: 2,
        phase: 'entering',
        attempt: { ownerEpoch: 1, phaseAttempt: 2 },
        completion: 'timer',
      },
    });
    const releases = timer.releases();
    timer.invalidate();
    expect(timer.outcomes).toEqual([]);
    expect(timer.releases()).toBe(releases);
  });

  it('completes a new attempt requested by the previous completion callback exactly once', () => {
    const f = fixture();
    f.env.value = { ...f.env.value, preference: 'reduce' };
    const outcomes: PresentationOutcome[] = [];
    const complete: PresencePresentationFrame['complete'] = (_binding, outcome) => {
      outcomes.push(outcome);
      if (outcomes.length === 1) f.commit('leaving', { complete });
    };
    f.commit('entering', { complete });
    expect(outcomes).toEqual(['reduced-motion', 'reduced-motion']);
    expect(f.releases()).toBe(2);
    expect(f.scheduled.size).toBe(0);
  });
});
