import { expect, it } from 'vitest';
import {
  definePrototype,
  HOST_ELEMENT_CAP,
  type HitParticipationHandle,
  type HitParticipationRegion,
} from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
import {
  HIT_PARTICIPATION_HOST_BRIDGE_CAP,
  type HitParticipationPort,
} from '@proto.ui/module-hit-participation';
import { createRuntimeSession } from '../../src';

it('retains static same-owner declarations through repeatable view lifetime without event state', async () => {
  const root = document.createElement('div');
  const region = {};
  let hit!: HitParticipationHandle;
  const input = {
    top: { value: 0.5, unit: 'rem' as const },
    left: { value: 0.75, unit: 'rem' as const },
  };
  let projected: readonly HitParticipationRegion[] = [];
  const proto = definePrototype({
    name: 'static-hit-test',
    setup() {
      hit = asHitParticipation();
      hit.configure({ staticHitInset: input });
      hit.registerRegion(region);
      hit.registerRegion({ explicit: true }, { staticHitInset: null });
      input.top.value = 99;
      expect(() =>
        hit.configure({ mode: 'disabled', staticHitInset: { top: { value: -1, unit: 'px' } } })
      ).toThrow();
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
        [
          HIT_PARTICIPATION_HOST_BRIDGE_CAP,
          {
            supportsStaticHitInset: true,
            sync({ regions }: { regions: readonly HitParticipationRegion[] }) {
              projected = regions;
            },
          },
        ],
      ]);
    },
  });
  try {
    await session.mount();
    const port = session.caps.getPort<HitParticipationPort>('hit-participation')!;
    expect(port.getConfig().mode).toBe('participating');
    expect(projected.find((x) => x.target === root)?.staticHitInset?.top.value).toBe(0.5);
    expect(projected.find((x) => x.target === region)?.staticHitInset?.left.value).toBe(0.75);
    expect(projected[2].staticHitInset).toBeUndefined();
    expect(() => hit.configure({ staticHitInset: null })).toThrow();
    for (let epoch = 0; epoch < 2; epoch++) {
      await session.unmount();
      expect(projected).toEqual([]);
      expect(port.getRegions()).toHaveLength(2);
      await session.mount();
      expect(projected[0].staticHitInset?.top.value).toBe(0.5);
    }
    await session.dispose();
    expect(projected).toEqual([]);
    expect(port.getRegions()).toEqual([]);
  } finally {
    await session.dispose();
  }
});
