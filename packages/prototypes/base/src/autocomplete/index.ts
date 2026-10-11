import { createSearchFamily } from '../search-primitives/family';
const protocol = createSearchFamily('autocomplete', 'autocomplete');
export const AUTOCOMPLETE_FAMILY = protocol.family;
export const autocompleteRoot = protocol.root;
export const asAutocompleteRoot = protocol.rootHook;
export const autocompleteInput = protocol.input;
export const asAutocompleteInput = protocol.inputHook;
export const autocompleteContent = protocol.content;
export const asAutocompleteContent = protocol.contentHook;
export const autocompleteItem = protocol.item;
export const asAutocompleteItem = protocol.itemHook;
export const autocompleteEmpty = protocol.empty;
export const asAutocompleteEmpty = protocol.emptyHook;
export const autocompleteTrigger = protocol.trigger;
export const asAutocompleteTrigger = protocol.triggerHook;
export default autocompleteRoot;
export type {
  SearchRootProps as AutocompleteRootProps,
  SearchRootExposes as AutocompleteRootExposes,
  SearchRootAsHookContract as AutocompleteRootAsHookContract,
  SearchInputProps as AutocompleteInputProps,
  SearchInputExposes as AutocompleteInputExposes,
  SearchInputAsHookContract as AutocompleteInputAsHookContract,
  SearchContentProps as AutocompleteContentProps,
  SearchContentExposes as AutocompleteContentExposes,
  SearchContentAsHookContract as AutocompleteContentAsHookContract,
  SearchItemProps as AutocompleteItemProps,
  SearchItemExposes as AutocompleteItemExposes,
  SearchItemAsHookContract as AutocompleteItemAsHookContract,
  SearchEmptyProps as AutocompleteEmptyProps,
  SearchEmptyExposes as AutocompleteEmptyExposes,
  SearchEmptyAsHookContract as AutocompleteEmptyAsHookContract,
  SearchTriggerProps as AutocompleteTriggerProps,
  SearchTriggerExposes as AutocompleteTriggerExposes,
  SearchTriggerAsHookContract as AutocompleteTriggerAsHookContract,
} from '../search-primitives/types';
