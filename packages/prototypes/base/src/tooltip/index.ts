import tooltipRoot from './root';

export type {
  TooltipGroupAsHookContract,
  TooltipGroupExposes,
  TooltipGroupProps,
  TooltipOverlayAsHookContract,
  TooltipOverlayExposes,
  TooltipOverlayProps,
  TooltipOverlayStateHandles,
  TooltipContentAsHookContract,
  TooltipContentExposes,
  TooltipContentProps,
  TooltipArrowAsHookContract,
  TooltipArrowExposes,
  TooltipArrowProps,
  TooltipRootAsHookContract,
  TooltipRootExposes,
  TooltipRootProps,
  TooltipRootStateHandles,
  TooltipTriggerAsHookContract,
  TooltipTriggerExposes,
  TooltipTriggerProps,
} from './types';
export type { TooltipContextValue, TooltipGroupContextValue } from './shared';

export { TOOLTIP_CONTEXT, TOOLTIP_FAMILY, TOOLTIP_GROUP_CONTEXT } from './shared';
export { asTooltipGroup, default as tooltipGroup } from './group';
export { asTooltipRoot, default as tooltipRoot } from './root';
export { asTooltipTrigger, default as tooltipTrigger } from './trigger';
export { asTooltipOverlay, default as tooltipOverlay } from './overlay';
export { asTooltipContent, default as tooltipContent } from './content';
export { asTooltipArrow, default as tooltipArrow } from './arrow';

export default tooltipRoot;
