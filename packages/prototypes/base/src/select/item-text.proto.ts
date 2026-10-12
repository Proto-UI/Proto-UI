import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { SELECT_FAMILY } from './shared';

function setupSelectItemText(def: DefHandle<{}>): RenderFn {
  def.anatomy.claim(SELECT_FAMILY, { role: 'item-text' });
  return (renderer) => [renderer.r.slot()];
}

export const asSelectItemText = defineAsHook({
  name: 'as-select-item-text',
  setup: setupSelectItemText,
});

export default definePrototype({
  name: 'base-select-item-text',
  setup: setupSelectItemText,
});
