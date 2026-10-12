import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import { asTransition, type TransitionHandles } from '../src/transition';

it.each([false, true])(
  'authored hook retains a measurable cold view then releases initial appear=%s',
  async (appear) => {
    let transition: TransitionHandles | null = null;
    const tasks: Array<{ duration: number; task(): void; cancelled: boolean }> = [];
    const proto = definePrototype({
      name: 'cold-preparation-consumer',
      setup(def) {
        const handle = asTransition();
        transition = handle;
        handle.configure({ coldEntryPreparation: true, appear });
        def.expose.method('releaseCurrent', () => handle.controls.capturePreparation()?.());
        return (r) => [r.r.slot()];
      },
    });
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({ defaultOpen: true }),
      schedule: (t) => t(),
      commit: (_children, signal) => signal?.done(),
      scheduleDelay(duration, task) {
        const record = { duration, task, cancelled: false };
        tasks.push(record);
        return {
          cancel() {
            record.cancelled = true;
          },
        };
      },
    });
    try {
      await session.mount();
      const handle = transition as TransitionHandles | null;
      if (!handle) throw new Error('Transition hook was not installed');
      expect(handle.transitionState.get()).toBe('preparing');
      expect(handle.isPresent.get()).toBe(true);
      expect(tasks).toEqual([]);
      session.invokeInCallbackScope(() => handle.controls.capturePreparation()?.());
      expect(handle.transitionState.get()).toBe(appear ? 'entering' : 'entered');
      expect(tasks).toHaveLength(appear ? 1 : 0);
      expect(() => handle.configure({ coldEntryPreparation: false })).toThrow();
    } finally {
      await session.dispose();
    }
  }
);

it('keeps presence closed when a real preparing State watcher closes reentrantly', async () => {
  let transition: TransitionHandles | null = null;
  const proto = definePrototype({
    name: 'cold-preparation-reentrant-close',
    setup() {
      const handle = asTransition();
      transition = handle;
      handle.configure({ coldEntryPreparation: true });
      handle.transitionState.watch((_run, event) => {
        if (event.type === 'next' && event.next === 'preparing') handle.controls.leave();
      });
      return (r) => [r.r.slot()];
    },
  });
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({ defaultOpen: true }),
    schedule: (task) => task(),
    commit: (_c, signal) => signal?.done(),
  });
  try {
    await session.mount();
    const handle = transition as TransitionHandles | null;
    if (!handle) throw new Error('Transition hook was not installed');
    expect(handle.transitionState.get()).toBe('closed');
    expect(handle.isPresent.get()).toBe(false);
    expect(handle.controls.capturePreparation()).toBeNull();
  } finally {
    await session.dispose();
  }
});

it('does not read or write State after a preparing watcher synchronously disposes its owner', async () => {
  let transition: TransitionHandles | null = null;
  let disposal: Promise<void> | null = null;
  const proto = definePrototype({
    name: 'cold-preparation-reentrant-dispose',
    setup() {
      const handle = asTransition();
      transition = handle;
      handle.configure({ coldEntryPreparation: true });
      handle.transitionState.watch((_run, event) => {
        if (event.type === 'next' && event.next === 'preparing') disposal = session.dispose();
      });
      return (r) => [r.r.slot()];
    },
  });
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({ defaultOpen: false }),
    schedule: (task) => task(),
    commit: (_c, signal) => signal?.done(),
  });
  try {
    await session.mount();
    const handle = transition as TransitionHandles | null;
    if (!handle) throw new Error('Transition hook was not installed');
    expect(() => session.invokeInCallbackScope(() => handle.controls.enter())).not.toThrow();
    if (!disposal) throw new Error('Preparing watcher did not dispose its owner');
    await disposal;
  } finally {
    await session.dispose();
  }
});
