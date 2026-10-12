import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { SELECT_FAMILY } from './shared';
import type {
  SelectSeparatorProps,
  SelectSeparatorExposes,
  SelectSeparatorAsHookContract,
} from './types';

function setup(def: DefHandle<SelectSeparatorProps, SelectSeparatorExposes>): RenderFn {
  def.anatomy.claim(SELECT_FAMILY, { role: 'separator' });
  asAccessible().tree({ hidden: true });
  return () => null;
}

export const asSelectSeparator = defineAsHook<
  SelectSeparatorProps,
  SelectSeparatorExposes,
  SelectSeparatorAsHookContract
>({
  name: 'as-select-separator',
  setup,
});
export default definePrototype({ name: 'base-select-separator', setup });
