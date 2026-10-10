import { createMenuFamily } from '../menu-primitives/family';
const protocol = createMenuFamily('menubar', false);
export const MENUBAR_FAMILY = protocol.family;
export const menubarRoot = protocol.root;
export const asMenubarRoot = protocol.rootHook;
export const menubarTrigger = protocol.trigger;
export const asMenubarTrigger = protocol.triggerHook;
export const menubarContent = protocol.content;
export const asMenubarContent = protocol.contentHook;
export const menubarItem = protocol.item;
export const asMenubarItem = protocol.itemHook;
export default menubarRoot;
export type {
  MenuRootProps as MenubarRootProps,
  MenuRootExposes as MenubarRootExposes,
  MenuRootAsHookContract as MenubarRootAsHookContract,
  MenuTriggerProps as MenubarTriggerProps,
  MenuTriggerExposes as MenubarTriggerExposes,
  MenuTriggerAsHookContract as MenubarTriggerAsHookContract,
  MenuContentProps as MenubarContentProps,
  MenuContentExposes as MenubarContentExposes,
  MenuContentAsHookContract as MenubarContentAsHookContract,
  MenuItemProps as MenubarItemProps,
  MenuItemExposes as MenubarItemExposes,
  MenuItemAsHookContract as MenubarItemAsHookContract,
} from '../menu-primitives/types';
