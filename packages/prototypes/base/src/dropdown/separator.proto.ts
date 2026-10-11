import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { DROPDOWN_CONTEXT, DROPDOWN_FAMILY } from './shared';
import type { DropdownSeparatorProps } from './types';
function setup(def: DefHandle<DropdownSeparatorProps>) {
  def.context.subscribe(DROPDOWN_CONTEXT);
  def.anatomy.claim(DROPDOWN_FAMILY, { role: 'separator' });
  const a11y = asAccessible();
  a11y.role('separator');
  a11y.state('orientation', def.state.string('separatorOrientation', 'horizontal'));
}
export const asDropdownSeparator = defineAsHook<DropdownSeparatorProps>({
  name: 'as-dropdown-separator',
  setup,
});
export default definePrototype<DropdownSeparatorProps>({ name: 'base-dropdown-separator', setup });
