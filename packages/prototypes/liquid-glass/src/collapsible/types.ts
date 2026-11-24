import type {
  CollapsibleRootProps,
  CollapsibleRootExposes,
  CollapsibleRootAsHookContract,
  CollapsibleTriggerProps,
  CollapsibleTriggerExposes,
  CollapsibleTriggerAsHookContract,
  CollapsibleContentProps,
  CollapsibleContentExposes,
  CollapsibleContentAsHookContract,
} from '@proto.ui/prototypes-base/collapsible';

export type LiquidGlassCollapsibleTriggerVariant = 'regular' | 'prominent';
export type LiquidGlassCollapsibleMaterial = 'auto' | 'opaque';

export type LiquidGlassCollapsibleRootProps = CollapsibleRootProps;
export type LiquidGlassCollapsibleRootExposes = CollapsibleRootExposes;
export type LiquidGlassCollapsibleRootAsHookContract = CollapsibleRootAsHookContract;
export type LiquidGlassCollapsibleTriggerProps = CollapsibleTriggerProps & {
  variant?: LiquidGlassCollapsibleTriggerVariant;
  material?: LiquidGlassCollapsibleMaterial;
};
export type LiquidGlassCollapsibleTriggerExposes = CollapsibleTriggerExposes;
export type LiquidGlassCollapsibleTriggerAsHookContract = CollapsibleTriggerAsHookContract;
export type LiquidGlassCollapsibleContentProps = CollapsibleContentProps;
export type LiquidGlassCollapsibleContentExposes = CollapsibleContentExposes;
export type LiquidGlassCollapsibleContentAsHookContract = CollapsibleContentAsHookContract;
