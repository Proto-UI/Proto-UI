import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { DROPDOWN_FAMILY, DROPDOWN_GROUP_CONTEXT, DROPDOWN_GROUP_FAMILY } from './shared';
import type { DropdownLabelProps } from './types';
function setup(def: DefHandle<DropdownLabelProps>) {
  def.anatomy.claim(DROPDOWN_FAMILY, { role: 'label' });
  def.anatomy.claim(DROPDOWN_GROUP_FAMILY, { role: 'label' });
  const id = def.state.string('groupLabelId', '');
  const accessible = asAccessible();
  accessible.id(id);
  def.context.subscribe(DROPDOWN_GROUP_CONTEXT, (_run, next) =>
    id.set(next.labelId, 'reason: dropdown label identity')
  );
  def.lifecycle.onCreated((run) =>
    id.set(run.context.read(DROPDOWN_GROUP_CONTEXT).labelId, 'reason: dropdown label mounted')
  );
}
export const asDropdownLabel = defineAsHook<DropdownLabelProps>({
  name: 'as-dropdown-label',
  setup,
});
export default definePrototype<DropdownLabelProps>({ name: 'base-dropdown-label', setup });
