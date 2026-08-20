import tooltipRoot from './root.proto';

export type {
  TooltipAlign,
  TooltipContentAsHookContract,
  TooltipContentExposes,
  TooltipContentHandles,
  TooltipContentProps,
  TooltipContentStateHandles,
  TooltipGroupAsHookContract,
  TooltipGroupExposes,
  TooltipGroupProps,
  TooltipRootAsHookContract,
  TooltipRootExposes,
  TooltipRootProps,
  TooltipRootStateHandles,
  TooltipSide,
  TooltipTriggerAsHookContract,
  TooltipTriggerExposes,
  TooltipTriggerProps,
  TooltipTriggerStateHandles,
} from './types';
export type {
  TooltipContextValue,
  TooltipGroupContextValue,
  TooltipInteractionReason,
} from './shared';

export { TOOLTIP_CONTEXT, TOOLTIP_FAMILY, TOOLTIP_GROUP_CONTEXT } from './shared';
export { asTooltipGroup, default as tooltipGroup } from './group.proto';
export { asTooltipRoot, default as tooltipRoot } from './root.proto';
export { asTooltipTrigger, default as tooltipTrigger } from './trigger.proto';
export { asTooltipContent, default as tooltipContent } from './content.proto';

export default tooltipRoot;
