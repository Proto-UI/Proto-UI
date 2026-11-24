import type {
  DrawerContentProps as BaseDrawerContentProps,
  DrawerTriggerProps as BaseDrawerTriggerProps,
  DrawerCloseProps as BaseDrawerCloseProps,
} from '@proto.ui/prototypes-base/drawer';

export type LiquidGlassDrawerMaterial = 'auto' | 'opaque';
export type LiquidGlassDrawerCommandVariant = 'regular' | 'prominent';

export type DrawerContentProps = BaseDrawerContentProps & {
  /** Auto enables Liquid Glass material when the host supports it; opaque forces the solid fallback. */
  material?: LiquidGlassDrawerMaterial;
};

export type DrawerTriggerProps = BaseDrawerTriggerProps & {
  variant?: LiquidGlassDrawerCommandVariant;
  material?: LiquidGlassDrawerMaterial;
};

export type DrawerCloseProps = BaseDrawerCloseProps & {
  variant?: LiquidGlassDrawerCommandVariant;
};
