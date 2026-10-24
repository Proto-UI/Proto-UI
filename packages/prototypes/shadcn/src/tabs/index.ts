import tabsContent from './content.proto';
import tabsList from './list.proto';
import tabsRoot from './root.proto';
import tabsTrigger from './trigger.proto';

export type {
  ShadcnTabsRootProps,
  ShadcnTabsRootExposes,
  ShadcnTabsRootAsHookContract,
  ShadcnTabsListProps,
  ShadcnTabsListExposes,
  ShadcnTabsListAsHookContract,
  ShadcnTabsTriggerProps,
  ShadcnTabsTriggerExposes,
  ShadcnTabsTriggerStateHandles,
  ShadcnTabsTriggerAsHookContract,
  ShadcnTabsContentProps,
  ShadcnTabsContentExposes,
  ShadcnTabsContentAsHookContract,
} from './types';

export { tabsRoot, tabsList, tabsTrigger, tabsContent };
export { default as shadcnTabsRoot } from './root.proto';
export { default as shadcnTabsList } from './list.proto';
export { default as shadcnTabsTrigger } from './trigger.proto';
export { default as shadcnTabsContent } from './content.proto';

/** Text/default capability only, not complete Tabs recipe parity. */
export { TABS_PROJECTED_STYLES as SHADCN_TABS_TEXT_DEFAULT_STYLES } from './visual';
