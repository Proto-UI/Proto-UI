import type { ShadcnStyleProps } from '../style-scope';
import type {
  TabsContentAsHookContract,
  TabsContentExposes,
  TabsContentProps,
  TabsIndicatorAsHookContract,
  TabsIndicatorExposes,
  TabsIndicatorProps,
  TabsListAsHookContract,
  TabsListExposes,
  TabsListProps,
  TabsRootAsHookContract,
  TabsRootExposes,
  TabsRootProps,
  TabsTriggerAsHookContract,
  TabsTriggerExposes,
  TabsTriggerProps,
  TabsTriggerStateHandles,
} from '@proto.ui/prototypes-base/tabs';

export interface ShadcnTabsRootProps extends TabsRootProps, ShadcnStyleProps {}
export type ShadcnTabsRootExposes = TabsRootExposes;
export type ShadcnTabsRootAsHookContract = TabsRootAsHookContract;

export interface ShadcnTabsListProps extends TabsListProps, ShadcnStyleProps {
  variant?: 'default' | 'line';
  appearance?: 'default' | 'underline';
}
export type ShadcnTabsListExposes = TabsListExposes;
export type ShadcnTabsListAsHookContract = TabsListAsHookContract;

export interface ShadcnTabsTriggerProps extends TabsTriggerProps, ShadcnStyleProps {
  appearance?: 'default' | 'underline';
}
export type ShadcnTabsTriggerExposes = TabsTriggerExposes;
export type ShadcnTabsTriggerStateHandles = TabsTriggerStateHandles;
export type ShadcnTabsTriggerAsHookContract = TabsTriggerAsHookContract;

export interface ShadcnTabsContentProps extends TabsContentProps, ShadcnStyleProps {}
export type ShadcnTabsContentExposes = TabsContentExposes;
export type ShadcnTabsContentAsHookContract = TabsContentAsHookContract;

export interface ShadcnTabsIndicatorProps extends TabsIndicatorProps, ShadcnStyleProps {}
export type ShadcnTabsIndicatorExposes = TabsIndicatorExposes;
export type ShadcnTabsIndicatorAsHookContract = TabsIndicatorAsHookContract;
