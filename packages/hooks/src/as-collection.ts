import type { CollectionConfigPatch, CollectionExposes, CollectionHandles } from '@proto.ui/core';
import type { CollectionPort } from '@proto.ui/module-collection';
import type { PropsBaseType } from '@proto.ui/types';

import { definePrivilegedAsHook } from './privileged';

const DEFAULT_ITEM_ROLE = 'item';
const DEFAULT_ITEM_META_EXPOSE_KEY = '__collectionItem';

export const asCollection = definePrivilegedAsHook<PropsBaseType, CollectionHandles>({
  name: 'asCollection',
  setup({ def, ports }) {
    const collection = ports.collection as CollectionPort | undefined;
    if (!collection) {
      throw new Error('[AsHook] collection port unavailable for asCollection.');
    }

    const count = def.state.numberDiscrete('collectionCount', 0);
    const store = {
      configured: false,
      offOrder: undefined as (() => void) | undefined,
    };

    const sync = () => {
      if (!store.configured) return;
      // Count synchronization consumes structure only; metadata stays live in
      // getItems rather than being eagerly read and discarded on every update.
      count.set(collection.readProviderCount(), 'reason: asCollection.sync => collection count');
    };

    const handle: CollectionHandles = {
      count,
      configure: (patch: CollectionConfigPatch) => {
        const itemRole = patch.itemRole ?? DEFAULT_ITEM_ROLE;
        const ownerRole = patch.ownerRole ?? patch.rootRole ?? false;
        const itemMetaExposeKey = patch.itemMetaExposeKey ?? DEFAULT_ITEM_META_EXPOSE_KEY;
        collection.configureProvider({
          family: patch.family,
          itemRole,
          itemMetaExposeKey,
        });
        if (ownerRole) {
          def.anatomy.claim(patch.family, { role: ownerRole });
        }

        def.expose.state(
          (patch.exposeCountStateKey ?? 'count') as keyof CollectionExposes & string,
          count
        );
        def.expose.method(
          (patch.exposeItemsMethodKey ?? 'getCollectionItems') as keyof CollectionExposes & string,
          () => collection.readProviderItems()
        );
        def.expose.method(
          (patch.exposeCountMethodKey ?? 'getCollectionCount') as keyof CollectionExposes & string,
          () => collection.readProviderCount()
        );

        store.configured = true;
      },
      getItems: () => collection.readProviderItems(),
      getCount: () => collection.readProviderCount(),
    };

    def.lifecycle.onMounted(() => {
      sync();
      store.offOrder = collection.subscribeProvider(sync);
    });
    def.lifecycle.onUpdated(() => {
      sync();
    });
    def.lifecycle.onUnmounted(() => {
      store.offOrder?.();
      store.offOrder = undefined;
    });

    return handle;
  },
  reuse({ registration }) {
    return registration.state.result as CollectionHandles;
  },
});
