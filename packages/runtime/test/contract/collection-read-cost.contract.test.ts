import { expect, it } from 'vitest';
import {
  createAnatomyFamily,
  definePrototype,
  type CollectionHandles,
  type CollectionItemHandles,
  type RunHandle,
} from '@proto.ui/core';
import { asCollection, asCollectionItem } from '@proto.ui/hooks';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { createRuntimeSession } from '../../src';

async function fixture(count: number) {
  const family = createAnatomyFamily('collection-read-cost', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const rootToken = {};
  const tokens = Array.from({ length: count }, () => ({}));
  const order = [...tokens];
  let comparisons = 0;
  let metadataReads = 0;
  let provider!: CollectionHandles;
  let providerRun!: RunHandle<Record<string, unknown>>;
  const items: CollectionItemHandles[] = [];
  const metadata: Readonly<{ id: string; text: string; index: number; total: number }>[] =
    tokens.map((_, index) =>
      Object.freeze({ id: `item-${index}`, text: `Item ${index}`, index: 999, total: 999 })
    );
  const targets = new Map<object, object>();
  for (const token of [rootToken, ...tokens]) {
    targets.set(token, {
      compareDocumentPosition(other: object) {
        comparisons++;
        const next = [...targets].find(([, target]) => target === other)?.[0];
        return order.indexOf(token) < order.indexOf(next!) ? 4 : 2;
      },
    });
  }
  const rootProto = definePrototype({
    name: 'collection-read-cost-root',
    setup(def) {
      provider = asCollection();
      provider.configure({ family, rootRole: 'root' });
      def.lifecycle.onMounted((run) => {
        providerRun = run;
      });
    },
  });
  const itemProtos = tokens.map((_, index) =>
    definePrototype({
      name: `collection-read-cost-item-${index}`,
      setup() {
        const item = asCollectionItem();
        item.configure({
          family,
          getMeta: () => {
            metadataReads++;
            return metadata[index];
          },
        });
        items[index] = item;
      },
    })
  );
  const protos = new Map([
    [rootToken, rootProto],
    ...tokens.map((token, index) => [token, itemProtos[index]] as const),
  ]);
  const sessions = [rootToken, ...tokens].map((token) => {
    const proto = protos.get(token)!;
    return createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady: (wiring) =>
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [
            ANATOMY_PARENT_CAP,
            (candidate: unknown) => (tokens.includes(candidate as object) ? rootToken : null),
          ],
          [ANATOMY_GET_PROTO_CAP, (candidate: unknown) => protos.get(candidate as object) ?? null],
          [
            ANATOMY_ROOT_TARGET_CAP,
            (candidate: unknown) => targets.get(candidate as object) ?? null,
          ],
        ]),
    });
  });
  for (const session of sessions) await session.mount();
  return {
    provider,
    items,
    metadata,
    order,
    tokens,
    resetCosts() {
      comparisons = metadataReads = 0;
    },
    costs: () => ({ comparisons, metadataReads }),
    updateProvider: () => providerRun.update(),
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}

it('reads one ordered provider snapshot without recomputing the same host order for every metadata item', async () => {
  // M-COLLECTION-0001-C/D: the provider owns structural fields, metadata stays
  // live. The controlled host supplies order comparisons, not native DOM cost.
  const f = await fixture(24);
  try {
    f.resetCosts();
    const snapshot = f.provider.getItems();
    expect(snapshot.map((item) => item.id)).toEqual(f.metadata.map((item) => item.id));
    expect(snapshot.map((item) => item.index)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(snapshot.every((item) => item.total === 24)).toBe(true);
    expect(snapshot[0].first).toBe(true);
    expect(snapshot.at(-1)?.last).toBe(true);
    expect(f.metadata.every((item) => item.index === 999 && item.total === 999)).toBe(true);
    expect(f.costs().metadataReads).toBe(24);
    // A linear allowance for an already ordered input detects the former N
    // redundant whole-collection sorts, without fixing an exact sort algorithm.
    expect(f.costs().comparisons).toBeLessThanOrEqual(24 * 4);

    f.metadata[23] = Object.freeze({
      id: 'item-23',
      text: 'Updated immediately',
      index: 999,
      total: 999,
    });
    f.order.reverse();
    const reordered = f.provider.getItems();
    expect(reordered[0]).toMatchObject({
      id: 'item-23',
      text: 'Updated immediately',
      index: 0,
      total: 24,
      first: true,
      last: false,
    });
    expect(f.items[23].getSnapshot()).toMatchObject(reordered[0]);
  } finally {
    await f.dispose();
  }
});

it('synchronizes provider count without reading item metadata it does not consume', async () => {
  const f = await fixture(12);
  try {
    f.resetCosts();
    f.updateProvider();
    expect(f.provider.count.get()).toBe(12);
    expect(f.costs().metadataReads).toBe(0);
    // Avoiding the unused read must not turn actual item reads into cached data.
    f.metadata[4] = Object.freeze({ id: 'item-4', text: 'Fresh metadata', index: 999, total: 999 });
    expect(f.provider.getItems()[4]).toMatchObject({ text: 'Fresh metadata', index: 4, total: 12 });
    expect(f.items[4].getSnapshot()).toMatchObject({ text: 'Fresh metadata', index: 4, total: 12 });
  } finally {
    await f.dispose();
  }
});
