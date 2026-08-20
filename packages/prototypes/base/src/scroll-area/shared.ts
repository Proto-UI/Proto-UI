import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type ScrollAreaContextValue = {
  family: 'base-scroll-area';
};

export const SCROLL_AREA_CONTEXT = createContextKey<ScrollAreaContextValue>('base-scroll-area');

export const SCROLL_AREA_FAMILY = createAnatomyFamily('base-scroll-area', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    viewport: { cardinality: { min: 1, max: 1 } },
    scrollbar: { cardinality: { min: 0, max: 2 } },
    thumb: { cardinality: { min: 0, max: 2 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'viewport' },
    { kind: 'contains', parent: 'root', child: 'scrollbar' },
    { kind: 'contains', parent: 'scrollbar', child: 'thumb' },
  ],
});
