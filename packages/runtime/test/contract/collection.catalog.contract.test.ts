import { expect, it } from 'vitest';
import {
  createAnatomyFamily,
  type CollectionHandles,
  type CollectionItemHandles,
} from '@proto.ui/core';
import { asCollection, asCollectionItem } from '@proto.ui/hooks';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
} from '@proto.ui/module-anatomy';
import { createRuntimeSession } from '../../src';

it('T-COLLECTION-0002-CASE-RUNTIME: rejects configure before metadata mutation and preserves hook synchronization across view epochs', async () => {
  const family = createAnatomyFamily('collection-runtime', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const root = {},
    child = {};
  let provider!: CollectionHandles, item!: CollectionItemHandles;
  let starts = 0,
    stops = 0,
    setups = 0;
  const make = (token: object, isRoot: boolean) => {
    const proto = {
      name: isRoot ? 'collection-root' : 'collection-item',
      setup() {
        setups++;
        if (isRoot) {
          provider = asCollection();
          expect(asCollection()).toBe(provider);
          provider.configure({ family, rootRole: 'root' });
        } else {
          item = asCollectionItem();
          expect(asCollectionItem()).toBe(item);
          item.configure({ family, getMeta: () => ({ id: 'original' }) });
        }
      },
    };
    return createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (f) => f(),
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
              starts++;
              return () => {
                stops++;
              };
            },
          ],
        ]),
    });
  };
  const parent = make(root, true);
  const member = make(child, false);
  try {
    await parent.mount();
    await member.mount();
    expect(provider.getItems()[0].id).toBe('original');
    expect(() =>
      item.configure({ family, getMeta: () => ({ id: 'mutated-after-rejection' }) })
    ).toThrow();
    expect(item.getSnapshot().id).toBe('original');
    expect(provider.getItems()[0].id).toBe('original');
    expect(() => provider.configure({ family, itemRole: 'unknown' })).toThrow();
    expect(provider.getCount()).toBe(1);
    for (let epoch = 0; epoch < 2; epoch++) {
      await member.unmount();
      await parent.unmount();
      expect(stops).toBe(starts);
      await parent.mount();
      await member.mount();
      expect(starts - stops).toBe(1);
      expect(provider.count.get()).toBe(1);
      expect(item.collectionIndex.get()).toBe(0);
      expect(item.getSnapshot().id).toBe('original');
    }
    expect(setups).toBe(2);
    await member.dispose();
    expect(provider.getCount()).toBe(0);
    expect(provider.count.get()).toBe(0);
    await parent.dispose();
    expect(stops).toBe(starts);
  } finally {
    await member.dispose();
    await parent.dispose();
  }
});
