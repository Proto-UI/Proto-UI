import { defineAsHook, definePrototype, type RunHandle, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import {
  DROPDOWN_CONTEXT,
  DROPDOWN_FAMILY,
  DROPDOWN_GROUP_CONTEXT,
  DROPDOWN_GROUP_FAMILY,
} from './shared';
import type { DropdownGroupProps } from './types';
let nextGroup = 0;
function setup(def: DefHandle<DropdownGroupProps>) {
  def.context.subscribe(DROPDOWN_CONTEXT);
  def.anatomy.claim(DROPDOWN_FAMILY, { role: 'group' });
  def.anatomy.claim(DROPDOWN_GROUP_FAMILY, { role: 'root' });
  const labelId = `pui-dropdown-group-${++nextGroup}-label`;
  def.context.provide(DROPDOWN_GROUP_CONTEXT, { labelId });
  def.props.define({ a11yLabel: { type: 'string', empty: 'fallback' } });
  def.props.setDefaults({ a11yLabel: '' });
  const name = def.state.string('groupName', '');
  const labelledBy = def.state.string('groupLabelledBy', '');
  const accessible = asAccessible();
  accessible.role('group');
  accessible.name(name);
  accessible.relation('labelledBy', { target: labelledBy });
  const sync = (run: RunHandle<DropdownGroupProps>) => {
    const hasLabel = run.anatomy.has(DROPDOWN_GROUP_FAMILY, 'label');
    labelledBy.set(hasLabel ? labelId : '', 'reason: live dropdown group label');
    name.set(hasLabel ? '' : (run.props.get().a11yLabel ?? ''), 'reason: group label fallback');
  };
  def.anatomy.subscribeParts(DROPDOWN_GROUP_FAMILY, 'label', sync);
  def.lifecycle.onCreated(sync);
  def.props.watch(['a11yLabel'], sync);
}
export const asDropdownGroup = defineAsHook<DropdownGroupProps>({
  name: 'as-dropdown-group',
  setup,
});
export default definePrototype<DropdownGroupProps>({ name: 'base-dropdown-group', setup });
