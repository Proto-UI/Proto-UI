import { expect, it } from 'vitest';
import { createAnatomyFamily } from '@proto.ui/core';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  type AnatomyPort,
} from '@proto.ui/module-anatomy';
import { createRuntimeSession } from '../../src';

it('T-ANATOMY-0004-CASE-LIFETIME: actual Runtime preserves claims across view epochs and releases shared observation at terminal disposal', async () => {
  const family = createAnatomyFamily('runtime-anatomy', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const root = {},
    child = {};
  let attached = 0,
    detached = 0,
    setups = 0;
  let cancel!: () => void;
  let rootPort!: AnatomyPort;
  const changes: number[] = [];
  const make = (token: object, role: 'root' | 'item') => {
    const proto = {
      name: 'anatomy-' + role,
      setup(def: any) {
        setups++;
        def.anatomy.claim(family, { role });
        if (role === 'root') {
          cancel = def.anatomy.subscribeParts(family, 'item', (_run: any, parts: any[]) =>
            changes.push(parts.length)
          );
          def.lifecycle.onCreated(() => expect(cancel).toThrow());
        }
        return (r: any) => r.el('span', role);
      },
    };
    return createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (t) => t(),
      commit: (_c, s) => s?.done(),
      onRuntimeReady: (w) =>
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (i: unknown) => (i === child ? root : null)],
          [ANATOMY_GET_PROTO_CAP, () => proto],
          [ANATOMY_ROOT_TARGET_CAP, () => ({})],
          [
            ANATOMY_ORDER_OBSERVER_CAP,
            () => {
              attached++;
              return () => {
                detached++;
              };
            },
          ],
        ]),
    });
  };
  const parent = make(root, 'root');
  await parent.mount();
  rootPort = parent.caps.getPort<AnatomyPort>('anatomy')!;
  const item = make(child, 'item');
  await item.mount();
  expect(changes).toEqual([1]);
  try {
    for (let epoch = 0; epoch < 2; epoch++) {
      await parent.unmount();
      expect(detached).toBe(attached);
      expect(cancel).toThrow();
      expect(rootPort.order.partsOf(family, 'item')).toHaveLength(1);
      await parent.mount();
      expect(attached - detached).toBe(1);
      expect(rootPort.order.partsOf(family, 'item')).toHaveLength(1);
    }
    expect(setups).toBe(2);
    await item.dispose();
    expect(changes).toEqual([1, 0]);
    await parent.dispose();
    expect(detached).toBe(attached);
    expect(cancel).toThrow();
  } finally {
    await item.dispose();
    await parent.dispose();
  }
});
