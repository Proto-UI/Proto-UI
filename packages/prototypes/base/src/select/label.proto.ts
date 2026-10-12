import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { SELECT_FAMILY, SELECT_GROUP_FAMILY } from './shared';
import type { SelectLabelProps, SelectLabelExposes, SelectLabelAsHookContract } from './types';

function setup(def: DefHandle<SelectLabelProps, SelectLabelExposes>): RenderFn {
  def.anatomy.claim(SELECT_FAMILY, { role: 'label' });
  def.anatomy.claim(SELECT_GROUP_FAMILY, { role: 'label' });
  asAccessible().part(SELECT_GROUP_FAMILY, { key: 'label' });
  return (renderer) => [renderer.r.slot()];
}

export const asSelectLabel = defineAsHook<
  SelectLabelProps,
  SelectLabelExposes,
  SelectLabelAsHookContract
>({
  name: 'as-select-label',
  setup,
});
export default definePrototype({ name: 'base-select-label', setup });
