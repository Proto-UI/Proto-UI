import { describe, expect, it } from 'vitest';
import { createContextKey, definePrototype } from '@proto.ui/core';
import {
  CONTEXT_INSTANCE_TOKEN_CAP,
  CONTEXT_PARENT_CAP,
  type ContextPort,
} from '@proto.ui/module-context';
import { createRuntimeSession, type RuntimeHost } from '../../src';

// C-LIFECYCLE-0006 and C-CONTEXT-0012: temporary view detach is not disposal.
describe('Context instance lifetime', () => {
  it('T-CONTEXT-0003-CASE-LIFETIME: retains scopes and callbacks through epochs and cleans terminal owners', async () => {
    const key = createContextKey<{ value: number }>('context-lifetime');
    const providerToken = {};
    const consumerToken = {};
    const transitions: Array<[number, number]> = [];
    let providerSetups = 0;
    let consumerSetups = 0;
    const provider = definePrototype({
      name: 'context-life-provider',
      setup(def) {
        providerSetups++;
        def.context.provide(key, { value: 0 });
        def.lifecycle.onMounted((run) =>
          run.context.update(key, (prev) => ({ value: prev.value + 1 }))
        );
        return (r) => r.el('span', 'provider');
      },
    });
    const consumer = definePrototype({
      name: 'context-life-consumer',
      setup(def) {
        consumerSetups++;
        const seen = def.state.numberDiscrete('seen', 0);
        def.context.subscribe(key, (_run, next, prev) => {
          seen.set(next.value, 'reason: context transition');
          transitions.push([prev.value, next.value]);
        });
        return (r) => r.el('span', String(r.read.context.read(key).value));
      },
    });
    const host = (name: string, token: object): RuntimeHost<Record<string, unknown>> => ({
      prototypeName: name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [
            CONTEXT_PARENT_CAP,
            (instance: unknown) => (instance === consumerToken ? providerToken : null),
          ],
        ]);
      },
    });
    const p = createRuntimeSession(provider, host(provider.name, providerToken));
    const c = createRuntimeSession(consumer, host(consumer.name, consumerToken));
    const port = c.caps.getPort<ContextPort>('context')!;
    try {
      await p.mount();
      await c.mount();
      expect(transitions).toEqual([[0, 1]]);
      expect(port.resolveScope(key)).toBe(providerToken);
      await c.unmount();
      await p.unmount();
      expect(c.instancePhase).toBe('alive');
      expect(port.resolveScope(key)).toBe(providerToken);
      expect(port.dumpSubscriptions().some((row) => row.instance === consumerToken)).toBe(true);
      await c.mount();
      await p.mount();
      expect(transitions).toEqual([
        [0, 1],
        [1, 2],
      ]);
      expect([providerSetups, consumerSetups]).toEqual([1, 1]);
      expect(c.mountEpoch).toBe(2);
      await c.dispose();
      expect(port.dumpSubscriptions().some((row) => row.instance === consumerToken)).toBe(false);
      await p.unmount();
      await p.mount();
      expect(transitions).toEqual([
        [0, 1],
        [1, 2],
      ]);
      await p.dispose();
      expect(port.dumpProviders().some((row) => row.instance === providerToken)).toBe(false);
    } finally {
      await c.dispose();
      await p.dispose();
    }
  });
});
