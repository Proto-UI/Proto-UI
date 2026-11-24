import { describe, expect, it } from 'vitest';
import {
  snapshotPresencePresentation,
  tw,
  type PresentationChannel,
  type PresentationOutcome,
  type PresentationOwnerRef,
  type PresentationReceipt,
  type PresentationViewBinding,
} from '@proto.ui/core';
import { createPresenceController } from '../src/presence/controller';
import {
  createPresencePresentationProjector,
  type PresenceEnvironment,
  type PresenceSample,
} from '../src/presence/projector';
import type { PresencePresentationFrame } from '../src/presence/sink';

const linear = [0, 0, 1, 1] as const;
const easeOut = [0, 0, 0.58, 1] as const;
const closed = {
  opacity: 0,
  top: { px: 0, rootText: 0, containingBlock: -0.25 },
  blockSize: 0,
} as const;
const entered = {
  opacity: 0.8,
  top: { px: 0, rootText: 0, containingBlock: 0.1 },
  blockSize: 'intrinsic',
} as const;
const style = tw('fixed top-[10%] opacity-80');

function fixture() {
  let now = 0;
  let ticket = 0;
  let invalidate = () => {};
  let onNow: (() => void) | undefined;
  let rejectBlockSize = false;
  const queue = new Map<number, () => void>();
  const samples: PresenceSample[] = [];
  const outcomes: PresentationOutcome[] = [];
  const requested: (readonly PresentationChannel[] | undefined)[] = [];
  const env: { value: PresenceEnvironment } = {
    value: {
      preference: 'no-preference',
      visible: true,
      width: 400,
      height: 71,
      rootFontPx: 16,
      containingBlockHeight: 1000,
      intrinsicBlockSize: 120,
      supported: ['opacity', 'top', 'blockSize'],
    },
  };
  let releases = 0;
  const sink = createPresencePresentationProjector({
    binding: {} as PresentationViewBinding,
    now() {
      const callback = onNow;
      onNow = undefined;
      callback?.();
      return now;
    },
    environment(channels) {
      requested.push(channels);
      return env.value;
    },
    subscribe(callback) {
      invalidate = callback;
      return () => {
        invalidate = () => {};
      };
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
      if (rejectBlockSize && sample.blockSize !== undefined) return false;
      samples.push(sample);
      return true;
    },
    release() {
      releases++;
    },
  });
  const frame: PresencePresentationFrame = {
    view: 1,
    revision: 1,
    targetRevision: 1,
    style,
    owner: {
      owner: {} as PresentationOwnerRef,
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 300,
      timeoutMs: 1000,
    },
    closed,
    entered,
    easing: linear,
    channelEasing: { top: easeOut, blockSize: linear },
    bind() {},
    complete(_binding, outcome) {
      outcomes.push(outcome);
    },
  };
  return {
    sink,
    frame,
    env,
    samples,
    outcomes,
    queue,
    requested,
    releases: () => releases,
    invalidate: () => invalidate(),
    onNextNow(callback: () => void) {
      onNow = callback;
    },
    rejectBlockSize() {
      rejectBlockSize = true;
    },
    time(value: number) {
      now = value;
    },
    step(value: number) {
      now = value;
      const pending = [...queue.values()];
      queue.clear();
      for (const callback of pending) callback();
    },
  };
}

describe('composed top and intrinsic block-size presence channels', () => {
  it('snapshots both endpoint channels and their independent easing declarations', () => {
    const recipe = snapshotPresencePresentation({
      owner: {} as PresentationOwnerRef,
      closed,
      entered,
      easing: linear,
      channelEasing: { top: easeOut, blockSize: linear },
    });
    expect(recipe.closed).toEqual(closed);
    expect(recipe.entered).toEqual(entered);
    expect(recipe.closed.top).not.toBe(closed.top);
    expect(recipe.channelEasing).toEqual({ top: easeOut, blockSize: linear });
    expect(Object.isFrozen(recipe.entered)).toBe(true);
    expect(Object.isFrozen(recipe.entered.top)).toBe(true);
  });

  it('samples distinct positions, opacity and size on their own curves and completes all channels', () => {
    const f = fixture();
    f.sink.commit(f.frame);
    expect(f.requested.at(-1)).toEqual(['opacity', 'top', 'blockSize']);
    expect(f.samples.at(-1)).toEqual({
      opacity: 0,
      opacityBaseline: 0.8,
      top: -250,
      topBaseline: 100,
      blockSize: 0,
    });
    f.step(16);
    f.step(166);
    expect(f.samples.at(-1)?.top).toBeCloseTo(-250 + 350 * 0.684643187, 5);
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(0.4, 8);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(60, 8);
    expect(f.outcomes).toEqual([]);
    f.step(316);
    expect(f.samples.at(-1)).toEqual({
      opacity: 0.8,
      opacityBaseline: 0.8,
      top: 100,
      topBaseline: 100,
      blockSize: 120,
    });
    expect(f.outcomes).toEqual(['finished']);
    expect(f.queue.size).toBe(0);
    const count = f.samples.length;
    f.env.value = { ...f.env.value, intrinsicBlockSize: 240 };
    f.invalidate();
    expect(f.samples).toHaveLength(count);
    expect(f.releases()).toBe(1);
  });

  it('retargets both live bases from the acknowledged sample and settles at the existing deadline', () => {
    const f = fixture();
    f.sink.commit(f.frame);
    f.step(16);
    f.step(166);
    const displayed = f.samples.at(-1)!;
    f.env.value = {
      ...f.env.value,
      containingBlockHeight: 600,
      intrinsicBlockSize: 240,
      height: 9000,
    };
    f.invalidate();
    expect(f.samples.at(-1)).toMatchObject({
      top: displayed.top,
      blockSize: displayed.blockSize,
      opacity: displayed.opacity,
      topBaseline: 60,
    });
    const stale = [...f.queue.values()];
    expect(f.sink.settle('deadline')).toBe(true);
    expect(f.samples.at(-1)).toMatchObject({ top: 60, blockSize: 240, opacity: 0.8 });
    expect(f.outcomes).toEqual(['deadline']);
    expect(f.queue.size).toBe(0);
    const count = f.samples.length;
    stale.forEach((callback) => callback());
    expect(f.samples).toHaveLength(count);
    expect(f.outcomes).toEqual(['deadline']);
  });

  it('reverses all channels from display and waits for the slower shortened top curve', () => {
    const f = fixture();
    f.sink.commit(f.frame);
    f.step(16);
    f.step(166);
    const displayed = f.samples.at(-1);
    f.time(250);
    f.sink.commit({
      ...f.frame,
      revision: 2,
      owner: {
        ...f.frame.owner,
        revision: 2,
        phase: 'leaving',
        attempt: { ownerEpoch: 1, phaseAttempt: 2 },
      },
    });
    expect(f.samples.at(-1)).toEqual(displayed);
    f.step(400);
    expect(f.samples.at(-1)?.opacity).toBeCloseTo(0, 8);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(0, 8);
    expect(f.samples.at(-1)?.top).toBeGreaterThan(-250);
    expect(f.outcomes).toEqual([]);
    f.step(456);
    expect(f.samples.at(-1)).toMatchObject({ top: -250, opacity: 0, blockSize: 0 });
    expect(f.outcomes).toEqual(['finished']);
  });

  it('does not let a superseded clock read retarget the replacement attempt', () => {
    const control = fixture();
    const reentrant = fixture();
    for (const f of [control, reentrant]) {
      const entering = { ...f.frame, channelEasing: undefined };
      f.sink.commit(entering);
      f.step(16);
      f.step(166);
      const displayed = f.samples.at(-1);
      const leaving: PresencePresentationFrame = {
        ...entering,
        revision: 2,
        owner: {
          ...entering.owner,
          revision: 2,
          phase: 'leaving',
          attempt: { ownerEpoch: 1, phaseAttempt: 2 },
        },
      };
      f.time(250);
      if (f === control) f.sink.commit(leaving);
      else {
        f.onNextNow(() => f.sink.commit(leaving));
        f.step(250);
      }
      expect(f.samples.at(-1)).toEqual(displayed);
      expect(f.outcomes).toEqual([]);
      f.step(300);
      f.step(350);
      f.step(399);
      expect(f.outcomes).toEqual([]);
      f.step(400);
    }
    expect(control.outcomes).toEqual(['finished']);
    expect(reentrant.outcomes).toEqual(['finished']);
    expect(reentrant.samples.at(-1)).toEqual(control.samples.at(-1));
    expect(reentrant.samples.at(-1)).toMatchObject({ top: -250, opacity: 0, blockSize: 0 });
    expect(reentrant.queue.size).toBe(0);
  });

  it('reverses from the clamped sample accepted by the host instead of unpainted overshoot', () => {
    const f = fixture();
    const overshoot = [0, -1, 1, -1] as const;
    const entering: PresencePresentationFrame = {
      ...f.frame,
      style: tw('block'),
      closed: { opacity: 0, blockSize: 0 },
      entered: { opacity: 1, blockSize: 'intrinsic' },
      easing: overshoot,
      channelEasing: { blockSize: overshoot },
    };
    f.sink.commit(entering);
    f.step(16);
    f.step(166);
    // Both typed channels are constrained at the host application boundary.
    // The curve's negative raw values were never displayed or acknowledged.
    expect(f.samples.at(-1)).toEqual({ opacity: 0, blockSize: 0 });
    expect(f.outcomes).toEqual([]);
    f.time(250);
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
    expect(f.samples.at(-1)).toEqual({ opacity: 0, blockSize: 0 });
    expect(f.outcomes).toEqual(['finished']);
    expect(f.queue.size).toBe(0);
  });

  it('preserves projection failure for a block-size-only lease lost after acknowledgement', () => {
    const f = fixture();
    f.env.value = { ...f.env.value, supported: ['blockSize'] };
    f.sink.commit({
      ...f.frame,
      style: tw('block'),
      closed: { blockSize: 0 },
      entered: { blockSize: 'intrinsic' },
      channelEasing: undefined,
    });
    f.step(16);
    f.step(166);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(60, 8);
    const stale = [...f.queue.values()];
    f.env.value = { ...f.env.value, supported: [] };
    f.rejectBlockSize();
    f.invalidate();
    expect(f.outcomes).toEqual(['projection-failed']);
    expect(f.queue.size).toBe(0);
    expect(f.releases()).toBe(1);
    const count = f.samples.length;
    stale.forEach((callback) => callback());
    expect(f.samples).toHaveLength(count);
    expect(f.outcomes).toEqual(['projection-failed']);
  });

  it.each(['top', 'blockSize'] as const)(
    'settles atomically without transient writes when the host lacks %s',
    (missing) => {
      const f = fixture();
      f.env.value = {
        ...f.env.value,
        supported: f.env.value.supported.filter((channel) => channel !== missing),
      };
      f.sink.commit(f.frame);
      expect(f.samples.every((sample) => Object.keys(sample).length === 0)).toBe(true);
      expect(f.outcomes).toEqual(['missing-capability']);
      expect(f.queue.size).toBe(0);
    }
  );

  it('keeps owner revisions and receipt channels complete through the controller', () => {
    const frames: PresencePresentationFrame[] = [];
    const receipts: PresentationReceipt[] = [];
    const binding = {} as PresentationViewBinding;
    const controller = createPresenceController({
      setup() {},
      runtime() {},
      invalidate() {},
      dispatch: (callback) => callback(),
      callbackContext: () => ({}),
      watch: () => () => {},
      sink: () => sink,
      fallback() {},
    });
    const sink = {
      commit(frame: PresencePresentationFrame) {
        frames.push(frame);
        frame.bind(binding);
      },
      cancel() {},
      settle: () => true,
      release() {},
    };
    const owner = controller.facade.owner();
    owner.onCompletionRequest((_run, { receipt }) => receipts.push(receipt));
    controller.declare({
      owner: owner.ref,
      closed,
      entered,
      easing: linear,
      channelEasing: { top: easeOut, blockSize: linear },
    });
    const publish = (revision: number) => {
      controller.facade.publish(owner.writer, {
        owner: owner.ref,
        revision,
        phase: 'entering',
        attempt: { ownerEpoch: 1, phaseAttempt: revision },
        completion: 'presentation',
        durationMs: 300,
        timeoutMs: 1000,
      });
      controller.commit(style, 1, revision);
    };
    publish(1);
    expect(frames[0].closed).toEqual(closed);
    expect(frames[0].entered).toEqual(entered);
    expect(frames[0].channelEasing).toEqual({ top: easeOut, blockSize: linear });
    publish(2);
    frames[0].complete(binding, 'finished');
    expect(receipts).toEqual([]);
    frames[1].complete(binding, 'finished');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].channels).toEqual(['opacity', 'top', 'blockSize']);
    expect(receipts[0].ownerRevision).toBe(2);
    expect(controller.facade.isCurrent(owner.writer, receipts[0])).toBe(true);
    frames[1].complete(binding, 'finished');
    expect(receipts).toHaveLength(1);
    controller.dispose();
    expect(controller.facade.isCurrent(owner.writer, receipts[0])).toBe(false);
  });
});
