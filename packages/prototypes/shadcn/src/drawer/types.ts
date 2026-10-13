import type {
  DrawerTriggerProps as BaseDrawerTriggerProps,
  DrawerCloseProps as BaseDrawerCloseProps,
} from '@proto.ui/prototypes-base/drawer';

/** Explicit local long-label adaptation; default false preserves New York sizing. */
export type DrawerTriggerProps = BaseDrawerTriggerProps & { wrap?: boolean };
export type DrawerCloseProps = BaseDrawerCloseProps & { wrap?: boolean };
