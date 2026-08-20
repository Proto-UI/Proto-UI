import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { ExposePort } from '@proto.ui/module-expose';

import { createRuntimeSession, type RuntimeHost } from '../../src';

describe('runtime contract: expose instance lifecycle (v1)', () => {
  it('preserves registry entries across view epochs and invalidates the port on disposal', async () => {
    const api = { ping: () => 'pong' };
    const proto: Prototype = {
      name: 'expose-instance-lifecycle',
      setup(def) {
        def.expose('api', api);
        return (run) => run.el('div', 'ok');
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
    const exposePort = session.caps.getPort<ExposePort>('expose')!;

    const setupSnapshot = exposePort.getAll();
    await session.mount();
    await session.unmount();

    expect(session.instancePhase).toBe('alive');
    expect(session.mountPhase).toBe('detached');
    expect(exposePort.get('api')).toBe(api);
    expect(exposePort.getAll()).toEqual({ api });

    setupSnapshot.extra = true;
    expect(exposePort.has('extra')).toBe(false);

    await session.mount();
    expect(session.mountEpoch).toBe(2);
    expect(exposePort.get('api')).toBe(api);

    await session.dispose();
    expect(() => exposePort.getAll()).toThrow();
  });
});
