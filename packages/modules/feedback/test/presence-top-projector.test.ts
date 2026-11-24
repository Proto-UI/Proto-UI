import { describe, expect, it } from 'vitest';
import { tw, type PresentationOwnerRef, type PresentationViewBinding } from '@proto.ui/core';
import {
  createPresencePresentationProjector,
  type PresenceEnvironment,
  type PresenceSample,
} from '../src/presence/projector';
import type { PresencePresentationFrame } from '../src/presence/sink';

function fixture() {
  let now = 0,
    ticket = 0,
    revision = 0,
    invalidate = () => {};
  const queue = new Map<number, () => void>();
  const samples: PresenceSample[] = [];
  const outcomes: string[] = [];
  const env: { value: PresenceEnvironment } = {
    value: {
      preference: 'no-preference',
      visible: true,
      width: 560,
      height: 123,
      rootFontPx: 16,
      containingBlockHeight: 1000,
      supported: ['top', 'opacity'],
    },
  };
  let releases = 0;
  let failFallback = false;
  const sink = createPresencePresentationProjector({
    binding: {} as PresentationViewBinding,
    now: () => now,
    environment: () => env.value,
    subscribe(callback) {
      invalidate = callback;
      return () => {};
    },
    requestFrame(callback) {
      queue.set(++ticket, callback);
      return ticket;
    },
    cancelFrame(id) {
      queue.delete(id as number);
    },
    project(_style, sample, current) {
      if (!current()) return false;
      if (failFallback && Object.keys(sample).length === 0) throw new Error('fallback rejected');
      samples.push(sample);
      return true;
    },
    release() {
      releases++;
    },
  });
  const owner = {} as PresentationOwnerRef;
  const frame = (patch: Partial<PresencePresentationFrame> = {}): PresencePresentationFrame => ({
    view: 1,
    revision: ++revision,
    targetRevision: 1,
    style: tw('fixed top-[10%]'),
    owner: {
      owner,
      revision,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 300,
      timeoutMs: 1000,
    },
    closed: { top: { px: 0, rootText: 0, containingBlock: -0.25 }, opacity: 0 },
    entered: { top: { px: 0, rootText: 0, containingBlock: 0.1 }, opacity: 1 },
    easing: [0, 0, 1, 1],
    channelEasing: { top: [0, 0, 0.58, 1] },
    bind() {},
    complete(_binding, outcome) {
      outcomes.push(outcome);
    },
    ...patch,
  });
  return {
    sink,
    env,
    samples,
    outcomes,
    queue,
    frame,
    commit(patch: Partial<PresencePresentationFrame> = {}) {
      const next = frame(patch);
      sink.commit(next);
      return next;
    },
    time(value: number) {
      now = value;
    },
    step(value: number) {
      now = value;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback();
    },
    invalidate() {
      invalidate();
    },
    failFallback() {
      failFallback = true;
    },
    releases: () => releases,
  };
}
describe('independent containing-block presence channels', () => {
  it('uses containing-block height and distinct CSS ease-out/linear curves on the shared 300ms attempt', () => {
    const f = fixture();
    f.commit();
    expect(f.samples.at(-1)).toMatchObject({ top: -250, topBaseline: 100, opacity: 0 });
    expect(f.outcomes).toEqual([]);
    f.step(16);
    f.step(166);
    // CSS cubic-bezier(0,0,.58,1) reaches ~.684643 at half its duration.
    expect(f.samples.at(-1)?.top).toBeCloseTo(-250 + 350 * 0.684643187, 5);
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(0.5, 8);
    expect(f.outcomes).toEqual([]);
    f.step(316);
    expect(f.samples.at(-1)).toMatchObject({ top: 100, opacity: 1 });
    expect(f.outcomes).toEqual(['finished']);
    expect(f.queue.size).toBe(0);
  });
  it('reverses from the last acknowledged sample and waits for the slower shortened channel', () => {
    const f = fixture();
    const entering = f.commit();
    f.step(16);
    f.step(166);
    const displayed = f.samples.at(-1);
    f.time(250); // No frame was delivered between 166 and this reversal.
    f.sink.commit({
      ...entering,
      revision: 2,
      owner: {
        ...entering.owner,
        revision: 2,
        phase: 'leaving',
        attempt: { ownerEpoch: 1, phaseAttempt: 2 },
      },
    });
    expect(f.samples.at(-1)).toEqual(displayed);
    f.step(400);
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(0, 8);
    expect(f.samples.at(-1)?.top).toBeGreaterThan(-250);
    expect(f.outcomes).toEqual([]);
    f.step(456);
    expect(f.samples.at(-1)).toMatchObject({ top: -250, opacity: 0 });
    expect(f.outcomes).toEqual(['finished']);
  });
  it('retargets viewport changes from display and settles to the new basis at the existing deadline', () => {
    const f = fixture();
    f.commit();
    f.step(16);
    f.step(166);
    const displayed = f.samples.at(-1)?.top;
    f.env.value = { ...f.env.value, containingBlockHeight: 600, height: 9999 };
    f.invalidate();
    expect(f.samples.at(-1)?.top).toBe(displayed);
    f.sink.settle('deadline');
    expect(f.samples.at(-1)).toMatchObject({ top: 60, opacity: 1 });
    expect(f.outcomes).toEqual(['deadline']);
    expect(f.queue.size).toBe(0);
  });
  it.each([null, NaN, Infinity])(
    'does not substitute own-box geometry for an unresolved basis %s',
    (basis) => {
      const f = fixture();
      f.env.value = { ...f.env.value, containingBlockHeight: basis };
      f.commit();
      expect(f.samples.every((sample) => sample.top === undefined)).toBe(true);
      expect(f.outcomes).toEqual(['unresolved-units']);
      expect(f.queue.size).toBe(0);
    }
  );
  it('keeps semantic settlement when the host does not support top', () => {
    const f = fixture();
    f.env.value = { ...f.env.value, supported: ['opacity'] };
    f.commit();
    expect(
      f.samples.every((sample) => sample.top === undefined && sample.opacity === undefined)
    ).toBe(true);
    expect(f.outcomes).toEqual(['missing-capability']);
  });
  it.each(['missing-capability', 'unresolved-units'] as const)(
    'releases the active sample when %s fallback projection throws',
    (reason) => {
      const f = fixture();
      f.commit();
      f.step(16);
      f.step(166);
      expect(f.samples.at(-1)?.top).toBeDefined();
      const stale = [...f.queue.values()];
      const releases = f.releases();
      f.failFallback();
      f.env.value =
        reason === 'missing-capability'
          ? { ...f.env.value, supported: ['opacity'] }
          : { ...f.env.value, containingBlockHeight: null };
      expect(() => f.invalidate()).not.toThrow();
      expect(f.outcomes).toEqual(['projection-failed']);
      expect(f.releases()).toBe(releases + 1);
      expect(f.queue.size).toBe(0);
      const samples = f.samples.length;
      for (const callback of stale) callback();
      expect(f.samples).toHaveLength(samples);
      expect(f.outcomes).toEqual(['projection-failed']);
    }
  );
  it.each(['fixed', 'fixed top-[20%]', 'fixed hover:top-[10%]', 'fixed inset-0 top-[10%]'])(
    'rejects final top intent that cannot own the entered baseline: %s',
    (tokens) => {
      const f = fixture();
      f.commit({ style: tw(tokens) });
      expect(f.samples.every((sample) => sample.top === undefined)).toBe(true);
      expect(f.outcomes).toEqual(['unsupported-endpoint']);
      expect(f.queue.size).toBe(0);
    }
  );
  it('suppression releases the lease and invalidates previously queued callbacks', () => {
    const f = fixture();
    const initial = f.commit();
    f.step(16);
    f.step(166);
    const stale = [...f.queue.values()];
    f.sink.commit({ ...initial, revision: 2, style: tw('fixed') });
    const count = f.samples.length;
    for (const callback of stale) callback();
    expect(f.samples.length).toBe(count);
    expect(f.outcomes).toEqual(['unsupported-endpoint']);
    expect(f.releases()).toBeGreaterThan(0);
  });
  it.each(['reduce', 'unknown'] as const)('settles %s without requiring a frame', (preference) => {
    const f = fixture();
    f.env.value = { ...f.env.value, preference };
    f.commit();
    expect(f.samples.at(-1)).toMatchObject({ top: 100, opacity: 1 });
    expect(f.outcomes).toEqual([preference === 'reduce' ? 'reduced-motion' : 'unknown-preference']);
    expect(f.queue.size).toBe(0);
  });
  it('retains a real non-neutral opacity baseline and requires final semantic intent for it', () => {
    const f = fixture();
    f.commit({
      style: tw('opacity-80'),
      closed: { opacity: 0 },
      entered: { opacity: 0.8 },
      channelEasing: undefined,
    });
    f.step(16);
    f.step(166);
    expect(f.samples.at(-1)).toMatchObject({ opacityBaseline: 0.8 });
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(0.4, 8);
    f.step(316);
    expect(f.outcomes).toEqual(['finished']);
    const missing = fixture();
    missing.commit({ style: tw('bg-black'), closed: { opacity: 0 }, entered: { opacity: 0.8 } });
    expect(missing.outcomes).toEqual(['unsupported-endpoint']);
    expect(missing.samples.every((sample) => sample.opacity === undefined)).toBe(true);
  });
  it('keeps containing-block top and intrinsic block-size curves independent in one attempt', () => {
    const f = fixture();
    f.env.value = {
      ...f.env.value,
      intrinsicBlockSize: 200,
      supported: ['top', 'opacity', 'blockSize'],
    };
    const original = f.frame();
    f.sink.commit({
      ...original,
      closed: { ...original.closed, blockSize: 0 },
      entered: { ...original.entered, blockSize: 'intrinsic' },
      channelEasing: { ...original.channelEasing, blockSize: [0, 0, 1, 1] },
    });
    expect(f.samples.at(-1)).toMatchObject({ top: -250, opacity: 0, blockSize: 0 });
    expect(f.outcomes).toEqual([]);
    f.step(16);
    f.step(166);
    expect(f.samples.at(-1)?.top).toBeCloseTo(-250 + 350 * 0.684643187, 5);
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(0.5, 8);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(100, 8);
    expect(f.outcomes).toEqual([]);
    f.step(316);
    expect(f.samples.at(-1)).toMatchObject({ top: 100, opacity: 1, blockSize: 200 });
    expect(f.outcomes).toEqual(['finished']);
    expect(f.queue.size).toBe(0);
    const completedSamples = f.samples.length;
    f.env.value = { ...f.env.value, intrinsicBlockSize: 350 };
    f.invalidate();
    expect(f.samples).toHaveLength(completedSamples);
    expect(f.outcomes).toEqual(['finished']);
    expect(f.queue.size).toBe(0);
  });
});
