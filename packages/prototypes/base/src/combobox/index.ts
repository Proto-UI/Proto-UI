import { createSearchFamily } from '../search-primitives/family';
const protocol = createSearchFamily('combobox', 'combobox');
export const COMBOBOX_FAMILY = protocol.family;
export const comboboxRoot = protocol.root;
export const asComboboxRoot = protocol.rootHook;
export const comboboxInput = protocol.input;
export const asComboboxInput = protocol.inputHook;
export const comboboxContent = protocol.content;
export const asComboboxContent = protocol.contentHook;
export const comboboxItem = protocol.item;
export const asComboboxItem = protocol.itemHook;
export const comboboxEmpty = protocol.empty;
export const asComboboxEmpty = protocol.emptyHook;
export const comboboxTrigger = protocol.trigger;
export const asComboboxTrigger = protocol.triggerHook;
export default comboboxRoot;
export type {
  SearchRootProps as ComboboxRootProps,
  SearchRootExposes as ComboboxRootExposes,
  SearchRootAsHookContract as ComboboxRootAsHookContract,
  SearchInputProps as ComboboxInputProps,
  SearchInputExposes as ComboboxInputExposes,
  SearchInputAsHookContract as ComboboxInputAsHookContract,
  SearchContentProps as ComboboxContentProps,
  SearchContentExposes as ComboboxContentExposes,
  SearchContentAsHookContract as ComboboxContentAsHookContract,
  SearchItemProps as ComboboxItemProps,
  SearchItemExposes as ComboboxItemExposes,
  SearchItemAsHookContract as ComboboxItemAsHookContract,
  SearchEmptyProps as ComboboxEmptyProps,
  SearchEmptyExposes as ComboboxEmptyExposes,
  SearchEmptyAsHookContract as ComboboxEmptyAsHookContract,
  SearchTriggerProps as ComboboxTriggerProps,
  SearchTriggerExposes as ComboboxTriggerExposes,
  SearchTriggerAsHookContract as ComboboxTriggerAsHookContract,
} from '../search-primitives/types';
