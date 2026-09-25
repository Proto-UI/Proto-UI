import type { Prototype } from '@proto.ui/core';

/**
 * Governed Prototype bundle (record section I). The host names an entry key;
 * the peer resolves it. Arbitrary import strings never cross the wire.
 */
export type PrototypeBundle = {
  readonly bundleId: string;
  readonly digest: string;
  readonly entries: { readonly [key: string]: () => Promise<Prototype<any>> };
};

export function createBaseBundle(): PrototypeBundle {
  return {
    bundleId: 'proto-ui-base-v0',
    // v0 digest is the pinned catalog release; a content digest arrives with the
    // packaged bundle format.
    digest: 'catalog:0.3.0-alpha.1',
    entries: {
      'base-button': () => import('@proto.ui/prototypes-base/button').then((m) => m.default),
      'base-toggle': () => import('@proto.ui/prototypes-base/toggle').then((m) => m.default),
      'base-switch-root': () =>
        import('@proto.ui/prototypes-base/switch').then((m) => m.switchRoot),
      'base-switch-thumb': () =>
        import('@proto.ui/prototypes-base/switch').then((m) => m.switchThumb),
      'base-tabs-root': () => import('@proto.ui/prototypes-base/tabs').then((m) => m.tabsRoot),
      'base-tabs-content': () =>
        import('@proto.ui/prototypes-base/tabs').then((m) => m.tabsContent),
    },
  };
}
