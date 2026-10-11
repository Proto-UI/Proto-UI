import { createSearchFamily } from '../search-primitives/family';
const protocol = createSearchFamily('command', 'command');
export const COMMAND_FAMILY = protocol.family;
export const commandRoot = protocol.root;
export const asCommandRoot = protocol.rootHook;
export const commandInput = protocol.input;
export const asCommandInput = protocol.inputHook;
export const commandContent = protocol.content;
export const asCommandContent = protocol.contentHook;
export const commandItem = protocol.item;
export const asCommandItem = protocol.itemHook;
export const commandEmpty = protocol.empty;
export const asCommandEmpty = protocol.emptyHook;
export default commandRoot;
export type {
  SearchRootProps as CommandRootProps,
  SearchRootExposes as CommandRootExposes,
  SearchRootAsHookContract as CommandRootAsHookContract,
  SearchInputProps as CommandInputProps,
  SearchInputExposes as CommandInputExposes,
  SearchInputAsHookContract as CommandInputAsHookContract,
  SearchContentProps as CommandContentProps,
  SearchContentExposes as CommandContentExposes,
  SearchContentAsHookContract as CommandContentAsHookContract,
  SearchItemProps as CommandItemProps,
  SearchItemExposes as CommandItemExposes,
  SearchItemAsHookContract as CommandItemAsHookContract,
  SearchEmptyProps as CommandEmptyProps,
  SearchEmptyExposes as CommandEmptyExposes,
  SearchEmptyAsHookContract as CommandEmptyAsHookContract,
} from '../search-primitives/types';
