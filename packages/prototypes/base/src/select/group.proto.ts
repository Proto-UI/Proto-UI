import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { SELECT_FAMILY, SELECT_GROUP_FAMILY } from './shared';
import type { SelectGroupProps, SelectGroupExposes, SelectGroupAsHookContract } from './types';

function setup(def: DefHandle<SelectGroupProps, SelectGroupExposes>): RenderFn {
  def.anatomy.claim(SELECT_FAMILY, { role: 'group' });
  def.anatomy.claim(SELECT_GROUP_FAMILY, { role: 'root' });
  const accessible = asAccessible();
  accessible.role('group');
  accessible.relation('labelledBy', {
    target: { kind: 'part', family: SELECT_GROUP_FAMILY, role: 'label', key: 'label' },
  });
  return (renderer) => [renderer.r.slot()];
}

export const asSelectGroup = defineAsHook<
  SelectGroupProps,
  SelectGroupExposes,
  SelectGroupAsHookContract
>({
  name: 'as-select-group',
  setup,
});
export default definePrototype({ name: 'base-select-group', setup });
