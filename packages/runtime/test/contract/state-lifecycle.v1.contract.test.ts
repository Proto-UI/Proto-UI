import { describe, expect, it } from 'vitest';
import type { OwnedStateHandle, Prototype } from '@proto.ui/core';
import type { StatePort } from '@proto.ui/module-state';

import { createRuntimeSession, type RuntimeHost } from '../../src';

describe('runtime contract: state instance lifecycle (v1)', () => {
  it('preserves state and watchers across detached epochs, then invalidates them on dispose', async () => {
    let count!: OwnedStateHandle<number>;
    const events: Array<{ type: string; next?: number }> = [];
    const proto: Prototype = {
      name: 'state-instance-lifecycle',
      setup(def) {
        count = def.state.numberDiscrete('count', 0);
        return (run) => run.el('div', String(count.get()));
      },
    };
    const host: RuntimeHost<any> = {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };
    const session = createRuntimeSession(proto, host);
    const statePort = session.caps.getPort<StatePort>('state')!;
    statePort.watch(count, (_ctx, event) => events.push(event as any));

    await session.mount();
    session.invokeInCallbackScope(() => count.set(1));
    await session.unmount();

    expect(session.instancePhase).toBe('alive');
    expect(session.mountPhase).toBe('detached');
    expect(count.get()).toBe(1);
    expect(events).toEqual([{ type: 'next', prev: 0, next: 1, reason: undefined }]);

    session.invokeInCallbackScope(() => count.set(2));
    await session.mount();

    expect(session.mountEpoch).toBe(2);
    expect(count.get()).toBe(2);
    expect(events.at(-1)).toMatchObject({ type: 'next', prev: 1, next: 2 });

    await session.dispose();

    expect(events.at(-1)).toEqual({ type: 'disconnect', reason: 'unmount' });
    expect(() => count.get()).toThrow();
  });
});
