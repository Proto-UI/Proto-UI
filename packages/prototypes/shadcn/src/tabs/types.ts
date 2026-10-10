import type {
  TabsContentAsHookContract,
  TabsContentExposes,
  TabsContentProps,
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

export interface ShadcnTabsRootProps extends TabsRootProps {}
export type ShadcnTabsRootExposes = TabsRootExposes;
export type ShadcnTabsRootAsHookContract = TabsRootAsHookContract;

export interface ShadcnTabsListProps extends TabsListProps {
  appearance?: 'default' | 'underline';
}
export type ShadcnTabsListExposes = TabsListExposes;
export type ShadcnTabsListAsHookContract = TabsListAsHookContract;

export interface ShadcnTabsTriggerProps extends TabsTriggerProps {
  appearance?: 'default' | 'underline';
}
export type ShadcnTabsTriggerExposes = TabsTriggerExposes;
export type ShadcnTabsTriggerStateHandles = TabsTriggerStateHandles;
export type ShadcnTabsTriggerAsHookContract = TabsTriggerAsHookContract;

export interface ShadcnTabsContentProps extends TabsContentProps {}
export type ShadcnTabsContentExposes = TabsContentExposes;
export type ShadcnTabsContentAsHookContract = TabsContentAsHookContract;
