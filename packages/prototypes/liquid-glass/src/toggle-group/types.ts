import type {
  ToggleGroupRootProps,
  ToggleGroupRootExposes,
  ToggleGroupItemProps,
  ToggleGroupItemExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export type LiquidGlassToggleGroupVariant = 'regular' | 'prominent';
export type LiquidGlassToggleGroupSize = 'default' | 'sm' | 'lg';
export type LiquidGlassToggleGroupMaterial = 'auto' | 'opaque';

export interface LiquidGlassToggleGroupRootProps extends ToggleGroupRootProps {
  /** Regular floating glass container or tinted prominent prominence level. */
  variant?: LiquidGlassToggleGroupVariant;
  size?: LiquidGlassToggleGroupSize;
  /** Auto enhances when host backdrop support and user preferences permit. */
  material?: LiquidGlassToggleGroupMaterial;
}

export type LiquidGlassToggleGroupRootExposes = ToggleGroupRootExposes;

export interface LiquidGlassToggleGroupItemProps extends ToggleGroupItemProps {
  variant?: LiquidGlassToggleGroupVariant;
  size?: LiquidGlassToggleGroupSize;
}

export type LiquidGlassToggleGroupItemExposes = ToggleGroupItemExposes;
