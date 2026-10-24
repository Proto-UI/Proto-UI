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

it('leases the existing self host without exposing a host address or reopening setup configuration', async () => {
  const root = document.createElement('div');
  let hit!: HitParticipationHandle;
  let projected: readonly HitParticipationRegion[] = [];
  let rebind!: (next: HTMLElement | null, replaceBridge?: boolean) => void;
  const bridgeFrames: (readonly HitParticipationRegion[])[][] = [];
  const proto = definePrototype({
    name: 'self-hit-runtime-lease',
    setup() {
      hit = asHitParticipation();
      return (r) => r.slot();
    },
  });
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    schedule: (task) => task(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      const createBridge = () => {
        const frames: (readonly HitParticipationRegion[])[] = [];
        bridgeFrames.push(frames);
        return {
          supportsStaticHitInset: true,
          sync({ regions }: { regions: readonly HitParticipationRegion[] }) {
            frames.push(regions);
            projected = regions;
          },
        };
      };
      let bridge = createBridge();
      rebind = (next, replaceBridge = false) => {
        if (replaceBridge) bridge = createBridge();
        wiring.attach('hit-participation', [
          [HOST_ELEMENT_CAP, next as HTMLElement],
          [HIT_PARTICIPATION_HOST_BRIDGE_CAP, bridge],
        ]);
      };
      rebind(root);
    },
  });
  try {
    await session.mount();
    const release = hit.registerSelfRegion({
      staticHitInset: { left: { value: 0.75, unit: 'rem' } },
    });
    expect(projected).toHaveLength(1);
    expect(projected[0].target).toBe(root);
    expect(projected[0].staticHitInset?.left.value).toBe(0.75);
    expect(() => hit.configure({ staticHitInset: null })).toThrow();
    release();
    expect(projected).toHaveLength(1);
    expect(projected[0].target).toBe(root);
    expect(projected[0].staticHitInset).toBeUndefined();
    release();
    expect(projected[0].staticHitInset).toBeUndefined();
    let releaseInner!: () => void;
    const releaseOuter = hit.registerSelfRegion({
      get role() {
        releaseInner = hit.registerSelfRegion({
          role: 'inner',
          staticHitInset: { left: { value: 3, unit: 'px' } },
        });
        return 'outer';
      },
      staticHitInset: { left: { value: 7, unit: 'px' } },
    });
    const port = session.caps.getPort<HitParticipationPort>('hit-participation')!;
    expect(port.getRegions().map((x) => x.role)).toEqual(['inner', 'outer']);
    releaseOuter();
    expect(projected).toHaveLength(1);
    expect(projected[0].staticHitInset?.left.value).toBe(3);
    releaseInner();
    expect(projected[0].staticHitInset).toBeUndefined();
    const input = { left: { value: 12, unit: 'px' as const } };
    const retained = hit.registerSelfRegion({ staticHitInset: input });
    input.left.value = 99;
    expect(projected[0].staticHitInset?.left.value).toBe(12);
    expect(() =>
      hit.registerSelfRegion({ staticHitInset: { top: { value: NaN, unit: 'px' } } })
    ).toThrow();
    expect(projected[0].staticHitInset?.left.value).toBe(12);
    await session.unmount();
    expect(projected).toEqual([]);
    await session.mount();
    expect(projected[0].target).toBe(root);
    expect(projected[0].staticHitInset?.left.value).toBe(12);
    const replacement = document.createElement('div');
    rebind(replacement);
    expect(projected).toHaveLength(1);
    expect(projected[0].target).toBe(replacement);
    expect(projected[0].staticHitInset?.left.value).toBe(12);
    rebind(replacement, true);
    expect(bridgeFrames[0].at(-1)).toEqual([]);
    expect(bridgeFrames[1].at(-1)?.[0].target).toBe(replacement);
    expect(projected[0].staticHitInset?.left.value).toBe(12);
    retained();
    expect(projected[0].staticHitInset).toBeUndefined();
    rebind(null);
    expect(() => hit.registerSelfRegion({ mode: 'disabled' })).toThrow(/bound host/);
    rebind(root);
    expect(projected[0].target).toBe(root);
    expect(projected[0].mode).toBe('participating');
    let retirement!: Promise<void>;
    expect(() =>
      hit.registerSelfRegion({
        get role() {
          retirement = session.dispose();
          return 'retired-getter';
        },
        staticHitInset: { left: { value: 1, unit: 'px' } },
      })
    ).toThrow();
    await retirement;
    expect(projected).toEqual([]);
    expect(port.getRegions()).toEqual([]);
    expect(() => hit.registerSelfRegion()).toThrow();
    retained();
    expect(projected).toEqual([]);
  } finally {
    await session.dispose();
  }
});
