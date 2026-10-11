import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupCheckboxGroupItem } from './item-setup';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
  CheckboxGroupItemAsHookContract,
} from './types';
const setup = (def: DefHandle<CheckboxGroupItemProps, CheckboxGroupItemExposes>) =>
  setupCheckboxGroupItem(def, true);
export const asCheckboxGroupAll = defineAsHook<
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
  CheckboxGroupItemAsHookContract
>({ name: 'as-checkbox-group-all', setup });
export default definePrototype({ name: 'base-checkbox-group-all', setup });
