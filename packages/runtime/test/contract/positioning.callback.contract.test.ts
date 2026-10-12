import { expect, it } from 'vitest';
import { definePrototype, type AnchoredPositionConnection } from '@proto.ui/core';
import { ANCHORED_POSITION_HOST_CAP, type PositioningPort } from '@proto.ui/module-positioning';
import { createRuntimeSession } from '../../src';

it('delivers host completion inside the actual instance callback scope for State writes', async () => {
  let completion: AnchoredPositionConnection['onResolved'];
  let setReady!: () => void;
  let readReady!: () => boolean;
  const proto = definePrototype({
    name: 'positioning-callback-consumer',
    setup(def) {
      const ready = def.state.bool('ready', false);
      setReady = () => ready.set(true, 'reason: current positioning completed');
      readReady = () => ready.get();
      return () => null;
    },
  });
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    schedule: (t) => t(),
    commit: (_c, signal) => signal?.done(),
    onRuntimeReady: (writer) =>
      writer.attach('positioning', [
        [
          ANCHORED_POSITION_HOST_CAP,
          {
            attach(c: AnchoredPositionConnection) {
              completion = c.onResolved;
              return { update() {}, requestUpdate() {}, dispose() {} };
            },
          },
        ],
      ]),
  });
  try {
    await session.mount();
    const handle = session.caps.getPort<PositioningPort>('positioning')!.getAnchoredPosition();
    handle.connect({
      anchor: {},
      floating: {},
      config: {
        side: 'bottom',
        align: 'start',
        sideOffset: 0,
        alignOffset: 0,
        strategy: 'fixed',
        avoidCollisions: false,
        collisionBoundary: 'viewport',
        collisionPadding: 0,
      },
      onResolved: setReady,
    });
    expect(() => setReady()).toThrow();
    await Promise.resolve();
    expect(() => completion?.({ side: 'top', align: 'start', strategy: 'fixed' })).not.toThrow();
    expect(readReady()).toBe(true);
  } finally {
    await session.dispose();
  }
});
