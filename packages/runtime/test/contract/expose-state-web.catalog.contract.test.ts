import { expect, it } from 'vitest';
import { definePrototype, HOST_ELEMENT_CAP, type OwnedStateHandle } from '@proto.ui/core';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { createRuntimeSession } from '../../src';
it('T-EXPOSE-STATE-WEB-0001-CASE-RUNTIME: preserves external handle and state while suspending and replaying Web projection across view epochs', async () => {
  const host = document.createElement('div');
  let count!: OwnedStateHandle<number>;
  let record: Record<string, any> = {};
  let setups = 0;
  const session = createRuntimeSession(
    definePrototype({
      name: 'esw-runtime',
      setup(def) {
        setups++;
        count = def.state.numberDiscrete('count', 1);
        def.expose.state('count', count);
        return (r) => r.el('span', 'ok');
      },
    }),
    {
      prototypeName: 'esw-runtime',
      getRawProps: () => ({}),
      schedule: (f) => f(),
      commit: (_c, s) => s?.done(),
      onRuntimeReady(w) {
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (r: Record<string, unknown>) => {
              record = r;
            },
          ],
        ]);
        w.attach('expose-state-web', [[HOST_ELEMENT_CAP, host]]);
      },
    }
  );
  const external = record.count;
  try {
    await session.mount();
    expect(host.getAttribute('data-count')).toBe('1');
    for (const value of [2, 3]) {
      await session.unmount();
      session.invokeInCallbackScope(() => count.set(value));
      expect(external.get()).toBe(value);
      expect(host.getAttribute('data-count')).toBe(String(value - 1));
      await session.mount();
      expect(host.getAttribute('data-count')).toBe(String(value));
      expect(record.count).toBe(external);
    }
    expect(setups).toBe(1);
  } finally {
    await session.dispose();
  }
  expect(() => external.get()).toThrow();
});
