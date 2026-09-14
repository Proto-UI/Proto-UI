import type {
  CollectionItemConfigPatch,
  CollectionItemExposes,
  CollectionItemHandles,
  CollectionItemMeta,
  CollectionItemSnapshotExposed,
  RunHandle,
} from '@proto.ui/core';
import type { CollectionPort } from '@proto.ui/module-collection';
import type { PropsBaseType } from '@proto.ui/types';

import { definePrivilegedAsHook } from './privileged';

const DEFAULT_ROLE = 'item';
const DEFAULT_META_EXPOSE_KEY = '__collectionItem';

export const asCollectionItem = definePrivilegedAsHook<PropsBaseType, CollectionItemHandles>({
  name: 'asCollectionItem',
  setup({ def, ports }) {
    const collection = ports.collection as CollectionPort | undefined;
    if (!collection) {
      throw new Error('[AsHook] collection port unavailable for asCollectionItem.');
    }

    const index = def.state.numberDiscrete('collectionIndex', -1);
    const total = def.state.numberDiscrete('collectionTotal', 0);
    const first = def.state.bool('collectionFirst', false);
    const last = def.state.bool('collectionLast', false);
    const store = {
      configured: false,
      offOrder: undefined as (() => void) | undefined,
      getMeta: undefined as ((run: RunHandle<PropsBaseType>) => CollectionItemMeta) | undefined,
      run: undefined as RunHandle<PropsBaseType> | undefined,
      snapshot: {
        index: -1,
        total: 0,
        first: false,
        last: false,
      } as CollectionItemSnapshotExposed,
    };

    const readMeta = (): CollectionItemMeta => {
      if (store.getMeta && store.run) return store.getMeta(store.run);
      const { index: _index, total: _total, first: _first, last: _last, ...meta } = store.snapshot;
      return meta;
    };

    const writeSnapshot = (snapshot: CollectionItemSnapshotExposed) => {
      index.set(snapshot.index, 'reason: asCollectionItem.sync => index');
      total.set(snapshot.total, 'reason: asCollectionItem.sync => total');
      first.set(snapshot.first, 'reason: asCollectionItem.sync => first');
      last.set(snapshot.last, 'reason: asCollectionItem.sync => last');
      store.snapshot = snapshot;
    };

    const buildSnapshot = (): CollectionItemSnapshotExposed => {
      const meta = readMeta();
      const position = collection.readItemPosition();
      const lastKnownPosition = {
        index: store.snapshot.index,
        total: store.snapshot.total,
        first: store.snapshot.first,
        last: store.snapshot.last,
      };
      const effectivePosition =
        position.index < 0 && position.total === 0 ? lastKnownPosition : position;
      return {
        ...meta,
        ...effectivePosition,
      };
    };

    const sync = () => {
      if (!store.configured) return;
      writeSnapshot(buildSnapshot());
    };

    const handle: CollectionItemHandles = {
      collectionIndex: index,
      collectionTotal: total,
      collectionFirst: first,
      collectionLast: last,
      configure: (patch: CollectionItemConfigPatch) => {
        const role = patch.role ?? DEFAULT_ROLE;
        const metaExposeKey = patch.metaExposeKey ?? DEFAULT_META_EXPOSE_KEY;
        collection.configureItem({
          family: patch.family,
          role,
        });
        store.getMeta = patch.getMeta as typeof store.getMeta;
        def.anatomy.claim(patch.family, { role });

        def.expose.state(
          (patch.exposeIndexStateKey ?? 'collectionIndex') as keyof CollectionItemExposes & string,
          index
        );
        def.expose.state(
          (patch.exposeTotalStateKey ?? 'collectionTotal') as keyof CollectionItemExposes & string,
          total
        );
        def.expose.state(
          (patch.exposeFirstStateKey ?? 'collectionFirst') as keyof CollectionItemExposes & string,
          first
        );
        def.expose.state(
          (patch.exposeLastStateKey ?? 'collectionLast') as keyof CollectionItemExposes & string,
          last
        );
        def.expose.method(
          (patch.exposeSnapshotMethodKey ?? 'getCollectionItem') as keyof CollectionItemExposes &
            string,
          () => buildSnapshot()
        );
        def.expose.method(metaExposeKey as keyof CollectionItemExposes & string, () =>
          buildSnapshot()
        );

        store.configured = true;
      },
      getSnapshot: () => buildSnapshot(),
    };

    def.lifecycle.onMounted((run) => {
      store.run = run;
      sync();
      store.offOrder = collection.subscribeItem(sync);
    });
    def.lifecycle.onUpdated((run) => {
      store.run = run;
      sync();
    });
    def.lifecycle.onUnmounted(() => {
      store.offOrder?.();
      store.offOrder = undefined;
      store.run = undefined;
    });

    return handle;
  },
  reuse({ registration }) {
    return registration.state.result as CollectionItemHandles;
  },
});
