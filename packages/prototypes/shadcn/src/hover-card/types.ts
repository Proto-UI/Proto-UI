import type {
  HoverCardContentAsHookContract,
  HoverCardContentExposes,
  HoverCardContentProps,
  HoverCardRootAsHookContract,
  HoverCardRootExposes,
  HoverCardRootProps,
  HoverCardTriggerAsHookContract,
  HoverCardTriggerExposes,
  HoverCardTriggerProps,
} from '@proto.ui/prototypes-base/hover-card';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnHoverCardRootProps = HoverCardRootProps & ShadcnStyleProps;
export type ShadcnHoverCardRootExposes = HoverCardRootExposes;
export type ShadcnHoverCardRootAsHookContract = HoverCardRootAsHookContract;

export type ShadcnHoverCardTriggerProps = HoverCardTriggerProps & ShadcnStyleProps;
export type ShadcnHoverCardTriggerExposes = HoverCardTriggerExposes;
export type ShadcnHoverCardTriggerAsHookContract = HoverCardTriggerAsHookContract;

export type ShadcnHoverCardContentProps = HoverCardContentProps & ShadcnStyleProps;
export type ShadcnHoverCardContentExposes = HoverCardContentExposes;
export type ShadcnHoverCardContentAsHookContract = HoverCardContentAsHookContract;
