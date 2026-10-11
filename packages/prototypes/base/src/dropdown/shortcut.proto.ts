import { defineAsHook, definePrototype, type DefHandle, type State } from '@proto.ui/core';
import { DROPDOWN_FAMILY, DROPDOWN_ITEM_CONTEXT } from './shared';
import type { DropdownShortcutProps } from './types';
function setup(def: DefHandle<DropdownShortcutProps>) {
  def.anatomy.claim(DROPDOWN_FAMILY, { role: 'shortcut' });
  const active = def.state.bool('active', false);
  def.expose.state('active', active);
  def.context.subscribe(DROPDOWN_ITEM_CONTEXT, (_run, next) =>
    active.set(next.active, 'reason: shortcut parent active')
  );
  def.lifecycle.onCreated((run) =>
    active.set(
      run.context.read(DROPDOWN_ITEM_CONTEXT).active,
      'reason: shortcut parent active init'
    )
  );
}
export const asDropdownShortcut = defineAsHook<
  DropdownShortcutProps,
  Record<string, unknown>,
  { state: { active: State<boolean> } }
>({ name: 'as-dropdown-shortcut', setup });
export default definePrototype<DropdownShortcutProps>({ name: 'base-dropdown-shortcut', setup });
