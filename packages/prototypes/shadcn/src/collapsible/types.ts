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
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnCollapsibleTriggerVariant = 'default' | 'ghost' | 'outline' | 'plain';
export type ShadcnCollapsibleTriggerSize = 'default' | 'sm' | 'icon';
export type ShadcnCollapsibleContentVariant = 'default' | 'plain';

export type ShadcnCollapsibleRootProps = CollapsibleRootProps & ShadcnStyleProps;
export type ShadcnCollapsibleRootExposes = CollapsibleRootExposes;
export type ShadcnCollapsibleRootAsHookContract = CollapsibleRootAsHookContract;
export type ShadcnCollapsibleTriggerProps = CollapsibleTriggerProps &
  ShadcnStyleProps & {
    variant?: ShadcnCollapsibleTriggerVariant;
    size?: ShadcnCollapsibleTriggerSize;
  };
export type ShadcnCollapsibleTriggerExposes = CollapsibleTriggerExposes;
export type ShadcnCollapsibleTriggerAsHookContract = CollapsibleTriggerAsHookContract;
export type ShadcnCollapsibleContentProps = CollapsibleContentProps &
  ShadcnStyleProps & {
    variant?: ShadcnCollapsibleContentVariant;
  };
export type ShadcnCollapsibleContentExposes = CollapsibleContentExposes;
export type ShadcnCollapsibleContentAsHookContract = CollapsibleContentAsHookContract;
