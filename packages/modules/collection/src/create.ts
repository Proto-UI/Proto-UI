import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type {
  AnatomyFamily,
  CollectionItemMeta,
  CollectionItemSnapshot,
  CollectionItemSnapshotExposed,
  Unsubscribe,
} from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';

import type {
  CollectionFacade,
  CollectionItemConfig,
  CollectionItemHandleForModule,
  CollectionItemPosition,
  CollectionModule,
  CollectionPort,
  CollectionProviderConfig,
  CollectionHandleForModule,
} from './types';

const DEFAULT_POSITION: CollectionItemPosition = Object.freeze({
  index: -1,
  total: 0,
  first: false,
  last: false,
});

class CollectionModuleImpl extends ModuleBase {
  private providerConfig: CollectionProviderConfig | null = null;
  private itemConfig: CollectionItemConfig | null = null;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly anatomy: AnatomyPort
  ) {
    super(caps);
  }

  readonly providerHandle: CollectionHandleForModule = {
    configure: (config) => this.configureProvider(config),
    readItems: () => this.readProviderItems(),
    readCount: () => this.readProviderCount(),
    subscribe: (cb) => this.subscribeProvider(cb),
  };

  readonly itemHandle: CollectionItemHandleForModule = {
    configure: (config) => this.configureItem(config),
    readPosition: () => this.readItemPosition(),
    buildSnapshot: (meta) => this.buildItemSnapshot(meta),
    subscribe: (cb) => this.subscribeItem(cb),
  };

  readonly facade: CollectionFacade = {
    getCollection: () => this.providerHandle,
    getCollectionItem: () => this.itemHandle,
  };

  readonly port: CollectionPort = {
    configureProvider: (config) => this.configureProvider(config),
    configureItem: (config) => this.configureItem(config),
    readProviderItems: () => this.readProviderItems(),
    readProviderCount: () => this.readProviderCount(),
    readItemPosition: () => this.readItemPosition(),
    buildItemSnapshot: (meta) => this.buildItemSnapshot(meta),
    subscribeProvider: (cb) => this.subscribeProvider(cb),
    subscribeItem: (cb) => this.subscribeItem(cb),
  };

  private ensureSetup(op: string): void {
    this.sys.ensureSetup(op);
  }

  private configureProvider(config: CollectionProviderConfig): void {
    this.ensureSetup('collection.configureProvider');
    this.providerConfig = Object.freeze({ ...config });
  }

  private configureItem(config: CollectionItemConfig): void {
    this.ensureSetup('collection.configureItem');
    this.itemConfig = Object.freeze({ ...config });
  }

  private readProviderItems(): readonly CollectionItemSnapshot[] {
    const config = this.providerConfig;
    if (!config) return [];
    const parts = this.anatomy.order.partsOf(config.family as AnatomyFamily, config.itemRole, {
      missing: 'empty',
    });
    const total = parts.length;
    return parts.map((part, index) => ({
      ...readItemSnapshot(part, config.itemMetaExposeKey),
      index,
      total,
      first: index === 0,
      last: index === total - 1,
    }));
  }

  private readProviderCount(): number {
    const config = this.providerConfig;
    if (!config) return 0;
    return this.anatomy.order.partsOf(config.family as AnatomyFamily, config.itemRole, {
      missing: 'empty',
    }).length;
  }

  private readItemPosition(): CollectionItemPosition {
    const config = this.itemConfig;
    if (!config) return DEFAULT_POSITION;

    const parts = this.anatomy.order.partsOf(config.family as AnatomyFamily, config.role, {
      missing: 'null',
    });
    if (parts == null) return DEFAULT_POSITION;

    const self = this.anatomy.resolveSelfInstance();
    const index = parts.findIndex((part) => this.anatomy.resolvePartInstance(part) === self);
    const total = parts.length;
    return {
      index,
      total,
      first: index === 0 && total > 0,
      last: index >= 0 && index === total - 1,
    };
  }

  private buildItemSnapshot(meta: CollectionItemMeta): CollectionItemSnapshotExposed {
    return {
      ...meta,
      ...this.readItemPosition(),
    };
  }

  private subscribeProvider(cb: () => void): Unsubscribe {
    const config = this.providerConfig;
    if (!config) return () => {};
    return this.anatomy.subscribeOrder(config.family as AnatomyFamily, cb);
  }

  private subscribeItem(cb: () => void): Unsubscribe {
    const config = this.itemConfig;
    if (!config) return () => {};
    return this.anatomy.subscribeOrder(config.family as AnatomyFamily, cb);
  }
}

function readItemSnapshot(part: { getExpose(key: string): unknown | null }, exposeKey: string) {
  const value = part.getExpose(exposeKey);
  if (!value) return {};
  if (typeof value === 'function') {
    const next = value();
    return next && typeof next === 'object' ? next : {};
  }
  return typeof value === 'object' ? value : {};
}

export function createCollectionModule(ctx: ModuleFactoryArgs): CollectionModule {
  const { init, caps, deps } = ctx;
  const anatomy = deps.requirePort<AnatomyPort>('anatomy');

  return createModule<'collection', 'instance', CollectionFacade, CollectionPort>({
    name: 'collection',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ caps }) => {
      const impl = new CollectionModuleImpl(caps, anatomy);
      return {
        facade: impl.facade,
        port: impl.port,
        hooks: {
          onProtoPhase: (p) => impl.onProtoPhase(p),
        },
      };
    },
  }) as CollectionModule;
}

export const CollectionModuleDef = defineModule({
  name: 'collection',
  resourceOwnership: 'instance',
  deps: ['anatomy'],
  create: createCollectionModule,
});
