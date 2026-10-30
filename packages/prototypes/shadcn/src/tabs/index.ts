import tabsContent from './content.proto';
import tabsIndicator from './indicator.proto';
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
  ShadcnTabsIndicatorProps,
  ShadcnTabsIndicatorExposes,
  ShadcnTabsIndicatorAsHookContract,
} from './types';

export { tabsRoot, tabsList, tabsTrigger, tabsContent, tabsIndicator };
export { default as shadcnTabsRoot } from './root.proto';
export { default as shadcnTabsList } from './list.proto';
export { default as shadcnTabsTrigger } from './trigger.proto';
export { default as shadcnTabsContent } from './content.proto';
export { default as shadcnTabsIndicator } from './indicator.proto';

/** Source-projected text/default styles; not a native or cross-adapter acceptance claim. */
export { TABS_PROJECTED_STYLES as SHADCN_TABS_TEXT_DEFAULT_STYLES } from './visual';
