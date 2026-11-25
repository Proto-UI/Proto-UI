import type {
  PopoverContentProps as BasePopoverContentProps,
  PopoverTriggerProps as BasePopoverTriggerProps,
  PopoverCloseProps as BasePopoverCloseProps,
} from '@proto.ui/prototypes-base/popover';

export type LiquidGlassMaterialMode = 'auto' | 'opaque';
export type LiquidGlassProminence = 'regular' | 'prominent';

export type PopoverContentProps = BasePopoverContentProps & {
  material?: LiquidGlassMaterialMode;
  prominence?: LiquidGlassProminence;
};

export type PopoverTriggerProps = BasePopoverTriggerProps & {
  material?: LiquidGlassMaterialMode;
  prominence?: LiquidGlassProminence;
};

export type PopoverCloseProps = BasePopoverCloseProps & {
  prominence?: LiquidGlassProminence;
};
