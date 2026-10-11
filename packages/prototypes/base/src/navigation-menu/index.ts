import { createMenuFamily } from '../menu-primitives/family';
const protocol = createMenuFamily('navigation-menu', true);
export const NAVIGATION_MENU_FAMILY = protocol.family;
export const navigationMenuRoot = protocol.root;
export const asNavigationMenuRoot = protocol.rootHook;
export const navigationMenuTrigger = protocol.trigger;
export const asNavigationMenuTrigger = protocol.triggerHook;
export const navigationMenuContent = protocol.content;
export const asNavigationMenuContent = protocol.contentHook;
export const navigationMenuItem = protocol.item;
export const asNavigationMenuItem = protocol.itemHook;
export const navigationMenuLink = protocol.link;
export const asNavigationMenuLink = protocol.linkHook;
export default navigationMenuRoot;
export type {
  MenuRootProps as NavigationMenuRootProps,
  MenuRootExposes as NavigationMenuRootExposes,
  MenuRootAsHookContract as NavigationMenuRootAsHookContract,
  MenuTriggerProps as NavigationMenuTriggerProps,
  MenuTriggerExposes as NavigationMenuTriggerExposes,
  MenuTriggerAsHookContract as NavigationMenuTriggerAsHookContract,
  MenuContentProps as NavigationMenuContentProps,
  MenuContentExposes as NavigationMenuContentExposes,
  MenuContentAsHookContract as NavigationMenuContentAsHookContract,
  MenuItemProps as NavigationMenuItemProps,
  MenuItemExposes as NavigationMenuItemExposes,
  MenuItemAsHookContract as NavigationMenuItemAsHookContract,
  MenuLinkProps as NavigationMenuLinkProps,
  MenuLinkExposes as NavigationMenuLinkExposes,
  MenuLinkAsHookContract as NavigationMenuLinkAsHookContract,
} from '../menu-primitives/types';
