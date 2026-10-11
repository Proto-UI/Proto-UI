import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupCheckboxGroupItem } from './item-setup';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
  CheckboxGroupItemAsHookContract,
} from './types';
const setup = (def: DefHandle<CheckboxGroupItemProps, CheckboxGroupItemExposes>) =>
  setupCheckboxGroupItem(def, false);
export const asCheckboxGroupItem = defineAsHook<
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
  CheckboxGroupItemAsHookContract
>({ name: 'as-checkbox-group-item', setup });
export default definePrototype({ name: 'base-checkbox-group-item', setup });
