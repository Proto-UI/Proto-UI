// packages/core/src/index.ts
export * from './handles';
export * from './prototype';
export * from './anatomy';

export * from './spec';
export * from './effects';

export * from './module';
export * from './errors';

export * from './state';
export * from './context';
export * from './a11y';
export * from './focus';
export * from './boundary';
export * from './hit-participation';
export * from './overlay';
export * from './positioning';
export * from './scroll';
export * from './move';
export * from './collection';
export * from './delay';
export * from './text-control';

export * from './caps';
export * from './image-view';
export * from './control-label';
export * from './material';
export * from './material-paint-reservation';
export * from './axis-input';

export * from './context-menu-input';

export * from './native-link';
export * from './resident-motion';

export * from './presence-presentation';
export * from './shader-presentation';

// Experimental declarations; no production MaterialContact provider is registered.
export type {
  MaterialContactLink,
  MaterialContactPlacement,
  MaterialContactPaintDeclaration,
  MaterialContactHandle,
} from './material-contact';
