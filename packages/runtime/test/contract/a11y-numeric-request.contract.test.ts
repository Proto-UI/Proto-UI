import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  type A11ySetValueEventPayload,
  type OwnedStateHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { type A11yPort } from '@proto.ui/module-a11y';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { createRuntimeSession } from '../../src';

// Portable Runtime verifies authored policy and raw host payload transport here.
// It does not implement or simulate a platform accessibility adapter.
describe('numeric accessibility requests remain authored proposals', () => {
  it('retains the declared route, raw value and view lifecycle without an automatic State write', async () => {
    const target = new EventTarget();
    const globalTarget = new EventTarget();
    const requests: unknown[] = [];
    let value!: OwnedStateHandle<number>;
    const prototype = definePrototype({
      name: 'numeric-action-runtime',
      setup(def) {
        value = def.state.numberRange('value', 0.5, { min: 0, max: 1 });
        const accessible = asAccessible();
        accessible.role('slider');
        accessible.state('valueNow', value);
        accessible.action('setValue', { event: 'host:old-value' });
        accessible.action('setValue', { event: 'host:numeric-value' });
        def.expose.event('requested', { payload: 'json' });
        def.event.on('host:numeric-value', (run, input) => {
          const event = input as A11ySetValueEventPayload;
          if (typeof event.value !== 'number' || !Number.isFinite(event.value)) return;
          run.expose.emit('requested', event.value);
        });
      },
    });
    const session = createRuntimeSession(prototype, {
      prototypeName: prototype.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (_name: string, payload: unknown) => requests.push(payload)],
        ]);
      },
    });
    const send = (next: unknown) =>
      target.dispatchEvent(Object.assign(new Event('host:numeric-value'), { value: next }));
    try {
      const a11y = session.caps.getPort<A11yPort>('a11y')!;
      expect(a11y.getSnapshot()).toMatchObject({
        states: { valueNow: 0.5 },
        actions: { setValue: { event: 'host:numeric-value' } },
      });
      send(0.1);
      expect(requests).toEqual([]);
      await session.mount();
      send(0.63);
      send(2.5);
      send('0.8');
      send(NaN);
      send(Infinity);
      target.dispatchEvent(new Event('host:numeric-value'));
      expect(requests).toEqual([0.63, 2.5]);
      expect(session.invokeInCallbackScope(() => value.get())).toBe(0.5);
      expect(a11y.getSnapshot()).toMatchObject({ states: { valueNow: 0.5 } });
      await session.unmount();
      send(0.75);
      expect(requests).toEqual([0.63, 2.5]);
      await session.mount();
      send(0.9);
      expect(requests).toEqual([0.63, 2.5, 0.9]);
    } finally {
      session.dispose();
    }
    send(0.4);
    expect(requests).toEqual([0.63, 2.5, 0.9]);
  });
});
