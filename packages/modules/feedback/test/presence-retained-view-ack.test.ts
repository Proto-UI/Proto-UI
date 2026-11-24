import { expect, it } from 'vitest';
import { tw, type PresentationOwnerRef, type PresentationViewBinding } from '@proto.ui/core';
import {
  createPresencePresentationProjector,
  type PresenceSample,
} from '../src/presence/projector';
import type { PresencePresentationFrame } from '../src/presence/sink';

function fixture() {
  let now = 0,
    ticket = 0,
    revision = 0;
  let binding = Object.freeze({}) as PresentationViewBinding;
  const owner = Object.freeze({}) as PresentationOwnerRef;
  const frames = new Map<number, () => void>();
  const samples: PresenceSample[] = [];
  const outcomes: string[] = [];
  let acceptTyped = true;
  const typedAttempts: PresenceSample[] = [];
  let onTyped: (() => void) | undefined;
  const env = {
    preference: 'no-preference' as const,
    visible: true,
    width: 200,
    height: 120,
    rootFontPx: 16,
    intrinsicBlockSize: 120,
    supported: ['blockSize'] as Array<'blockSize'>,
  };
  const sink = createPresencePresentationProjector({
    get binding() {
      return binding;
    },
    now: () => now,
    environment: () => env,
    subscribe: () => () => {},
    requestFrame(callback) {
      frames.set(++ticket, callback);
      return ticket;
    },
    cancelFrame(id) {
      frames.delete(id as number);
    },
    project(_style, sample, current) {
      if (!current()) return false;
      if (sample.blockSize !== undefined) {
        typedAttempts.push(sample);
        const callback = onTyped;
        onTyped = undefined;
        callback?.();
      }
      if (!current() || (sample.blockSize !== undefined && !acceptTyped)) return false;
      samples.push(sample);
      return true;
    },
    release() {},
  });
  function commit(
    phase: 'entering' | 'leaving' | 'closed' = 'entering',
    options: { view?: number; owner?: PresentationOwnerRef; epoch?: number } = {}
  ) {
    revision++;
    const frame: PresencePresentationFrame = {
      view: options.view ?? 1,
      revision,
      targetRevision: 1,
      style: tw('block'),
      owner: {
        owner: options.owner ?? owner,
        revision,
        phase,
        attempt:
          phase === 'closed' ? null : { ownerEpoch: options.epoch ?? 1, phaseAttempt: revision },
        completion: 'presentation',
        durationMs: 350,
        timeoutMs: 1000,
      },
      closed: { blockSize: 0 },
      entered: { blockSize: 'intrinsic' },
      easing: [0, 0, 1, 1],
      bind() {},
      complete(_binding, outcome) {
        outcomes.push(outcome);
      },
    };
    sink.commit(frame);
    return frame;
  }
  function at(time: number) {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback();
  }
  return {
    sink,
    commit,
    at,
    frames,
    samples,
    typedAttempts,
    outcomes,
    env,
    acceptTyped(value: boolean) {
      acceptTyped = value;
    },
    onTyped(callback: () => void) {
      onTyped = callback;
    },
    rebind() {
      binding = Object.freeze({}) as PresentationViewBinding;
    },
  };
}
function enteredThenClosed(f: ReturnType<typeof fixture>) {
  f.commit();
  f.at(16);
  f.at(366);
  expect(f.outcomes).toEqual(['finished']);
  f.commit('leaving');
  f.at(716);
  expect(f.outcomes).toEqual(['finished', 'finished']);
  expect(f.frames.size).toBe(0);
  f.env.intrinsicBlockSize = 80;
}

it('retains accepted entering-frame admission for the same view while acquiring a fresh semantic sample', () => {
  const f = fixture();
  enteredThenClosed(f);
  f.commit();
  expect(f.samples.at(-1)).toEqual({ blockSize: 0 });
  f.at(732);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo((80 * 16) / 350, 8);
  f.at(891);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
  f.at(1066);
  expect(f.samples.at(-1)).toEqual({ blockSize: 80 });
  expect(f.outcomes).toEqual(['finished', 'finished', 'finished']);
});

it.each(['view', 'owner', 'owner epoch', 'binding', 'cancel'] as const)(
  'does not carry entering-frame admission across a changed %s',
  (change) => {
    const f = fixture();
    enteredThenClosed(f);
    if (change === 'binding') f.rebind();
    if (change === 'cancel') f.sink.cancel();
    f.commit('entering', {
      ...(change === 'view' ? { view: 2 } : {}),
      ...(change === 'owner' ? { owner: Object.freeze({}) as PresentationOwnerRef } : {}),
      ...(change === 'owner epoch' ? { epoch: 2 } : {}),
    });
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    f.at(732);
    expect(f.samples.at(-1)?.blockSize).toBe(0);
    f.at(907);
    expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
    f.at(1082);
    expect(f.samples.at(-1)?.blockSize).toBe(80);
    expect(f.outcomes.at(-1)).toBe('finished');
  }
);

it('requires a new cold frame after a retained view rejects the fresh start sample', () => {
  const f = fixture();
  enteredThenClosed(f);
  f.acceptTyped(false);
  f.commit();
  expect(f.outcomes.at(-1)).toBe('projection-failed');
  expect(f.frames.size).toBe(0);
  f.acceptTyped(true);
  f.commit();
  f.at(732);
  expect(f.samples.at(-1)?.blockSize).toBe(0);
  f.at(907);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
});

it('cannot create entering-frame admission from a cancelled stale delivery', () => {
  const f = fixture();
  f.commit();
  const stale = [...f.frames.values()];
  f.sink.cancel();
  f.commit('leaving');
  f.at(350);
  for (const callback of stale) callback();
  f.env.intrinsicBlockSize = 80;
  f.commit();
  f.at(366);
  expect(f.samples.at(-1)?.blockSize).toBe(0);
  f.at(541);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
});

it('does not admit a replacement owner from an entering frame superseded during projection', () => {
  const f = fixture();
  const replacement = Object.freeze({}) as PresentationOwnerRef;
  f.commit();
  f.onTyped(() => f.commit('leaving', { owner: replacement }));
  f.at(16);
  f.at(366);
  expect(f.outcomes).toEqual(['finished']);
  f.env.intrinsicBlockSize = 80;
  f.commit('entering', { owner: replacement });
  f.at(382);
  expect(f.samples.at(-1)?.blockSize).toBe(0);
  f.at(557);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
});

it('keeps an already presented view warm across a hidden closed semantic publication without typed ownership', () => {
  const f = fixture();
  enteredThenClosed(f);
  f.env.visible = false;
  f.acceptTyped(false);
  const typedAttempts = f.typedAttempts.length;
  f.commit('closed');
  expect(f.typedAttempts).toHaveLength(typedAttempts);
  expect(f.sink.diagnostics?.()).not.toContain('projection-failed');
  expect(f.outcomes).toEqual(['finished', 'finished']);
  f.acceptTyped(true);
  f.env.visible = true;
  f.commit();
  expect(f.samples.at(-1)?.blockSize).toBe(0);
  f.at(732);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo((80 * 16) / 350, 8);
  f.at(891);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
});

it('does not retain frame admission when a closed semantic publication observes lost channel support', () => {
  const f = fixture();
  enteredThenClosed(f);
  f.env.visible = false;
  f.env.supported = [];
  f.commit('closed');
  f.env.visible = true;
  f.env.supported = ['blockSize'];
  f.commit();
  f.at(732);
  expect(f.samples.at(-1)?.blockSize).toBe(0);
  f.at(907);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
});

it('cannot acquire entering-frame admission from a hidden closed semantic publication alone', () => {
  const f = fixture();
  f.commit('leaving');
  f.at(350);
  f.env.visible = false;
  f.commit('closed');
  f.env.visible = true;
  f.env.intrinsicBlockSize = 80;
  f.commit();
  f.at(366);
  expect(f.samples.at(-1)?.blockSize).toBe(0);
  f.at(541);
  expect(f.samples.at(-1)?.blockSize).toBeCloseTo(40, 8);
});
