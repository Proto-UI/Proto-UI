import { expect, it } from 'vitest';
import { definePrototype, HOST_ELEMENT_CAP } from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
import {
  createWebHitParticipationHostBridge,
  HIT_PARTICIPATION_HOST_BRIDGE_CAP,
  type HitParticipationPort,
} from '@proto.ui/module-hit-participation';
import { createRuntimeSession } from '../../src';

it('T-HIT-PARTICIPATION-0001-CASE-LIFETIME: suspends view claims, restores on remount and releases terminal ownership', async () => {
  const root = document.createElement('div');
  const region = document.createElement('div');
  region.style.pointerEvents = 'auto';
  let setups = 0;
  const proto = definePrototype({
    name: 'hit-catalog-lifetime',
    setup() {
      setups++;
      asHitParticipation({ mode: 'disabled' }).registerRegion(region);
      return (r) => r.el('span', 'content');
    },
  });
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    schedule: (task) => task(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('hit-participation', [
        [HOST_ELEMENT_CAP, root],
        [HIT_PARTICIPATION_HOST_BRIDGE_CAP, createWebHitParticipationHostBridge()],
      ]);
    },
  });
  try {
    await session.mount();
    const port = session.caps.getPort<HitParticipationPort>('hit-participation')!;
    expect(region.style.pointerEvents).toBe('none');
    for (let epoch = 0; epoch < 2; epoch++) {
      await session.unmount();
      expect(region.style.pointerEvents).toBe('auto');
      expect(root.style.pointerEvents).toBe('');
      expect(port.getRegions()).toHaveLength(1);
      await session.mount();
      expect(region.style.pointerEvents).toBe('none');
    }
    expect(setups).toBe(1);
    await session.dispose();
    expect(region.style.pointerEvents).toBe('auto');
    expect(port.getRegions()).toHaveLength(0);
  } finally {
    await session.dispose();
  }
});
