import { describe, expect, it } from 'vitest';
import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type OwnedStateHandle,
} from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost, type RuntimeLifecycleEvent } from '../../src';

// C-LIFECYCLE-0002-I: definition-first authored same-checkpoint FIFO.
// Agent: dot
const checkpoints = [
  'onCreated',
  'onMounted',
  'onUpdated',
  'onUnmounted',
  'onBeforeDispose',
] as const;

function host(events: RuntimeLifecycleEvent[]): RuntimeHost<any> {
  return {
    prototypeName: 'lifecycle-same-checkpoint-order',
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onLifecycleEvent(event) {
      events.push(event);
    },
  };
}

describe('authored lifecycle callbacks share setup registration order', () => {
  it('preserves outer/hook FIFO, once deduplication and state visibility across two epochs', async () => {
    const calls: string[] = [];
    const events: RuntimeLifecycleEvent[] = [];
    let ready!: OwnedStateHandle<boolean>;
    let setupCalls = 0;
    let hookInstalls = 0;
    let capturedDef!: DefHandle<any>;
    function register(def: DefHandle<any>, label: string) {
      for (const checkpoint of checkpoints) {
        def.lifecycle[checkpoint](() => {
          if (checkpoint === 'onCreated' && label === 'A') ready.set(true, 'initial seed');
          if (checkpoint === 'onCreated' && label === 'B') expect(ready.get()).toBe(true);
          calls.push(`${checkpoint}:${label}`);
        });
      }
    }
    const useB = defineAsHook({
      name: 'asLifecycleSameCheckpointB',
      setup(def) {
        hookInstalls++;
        register(def, 'B');
      },
    });
    const prototype = definePrototype({
      name: 'lifecycle-same-checkpoint-order',
      setup(def) {
        setupCalls++;
        capturedDef = def;
        ready = def.state.bool('ready', false);
        register(def, 'A');
        const first = useB();
        register(def, 'C');
        expect(useB()).toBe(first);
        register(def, 'D');
        expect(calls).toEqual([]);
        return (r) => r.el('div', 'ordered');
      },
    });
    const session = createRuntimeSession(prototype, host(events));
    const expected = (checkpoint: (typeof checkpoints)[number]) =>
      ['A', 'B', 'C', 'D'].map((label) => `${checkpoint}:${label}`);
    expect(calls).toEqual(expected('onCreated'));
    for (const checkpoint of checkpoints) {
      expect(() => capturedDef.lifecycle[checkpoint](() => {})).toThrow(/phase/i);
    }
    for (let epoch = 1; epoch <= 2; epoch++) {
      await session.mount();
      expect(session.mountEpoch).toBe(epoch);
      expect(calls.slice(-4)).toEqual(expected('onMounted'));
      session.controller.update();
      expect(calls.slice(-4)).toEqual(expected('onUpdated'));
      await session.unmount();
      expect(calls.slice(-4)).toEqual(expected('onUnmounted'));
    }
    await session.dispose();
    expect(calls.slice(-4)).toEqual(expected('onBeforeDispose'));
    expect(calls).toEqual([
      ...expected('onCreated'),
      ...expected('onMounted'),
      ...expected('onUpdated'),
      ...expected('onUnmounted'),
      ...expected('onMounted'),
      ...expected('onUpdated'),
      ...expected('onUnmounted'),
      ...expected('onBeforeDispose'),
    ]);
    const prior = [...calls];
    await session.dispose();
    expect(calls).toEqual(prior);
    expect(setupCalls).toBe(1);
    expect(hookInstalls).toBe(1);
    expect(events.filter((event) => event.type === 'update.updated')).toHaveLength(2);
  });
});
