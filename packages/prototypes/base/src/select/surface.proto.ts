import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { SELECT_FAMILY } from './shared';

function setupSelectSurface(def: DefHandle<{}>): RenderFn {
  def.anatomy.claim(SELECT_FAMILY, { role: 'surface' });
  return (renderer) => [renderer.r.slot()];
}

export const asSelectSurface = defineAsHook({
  name: 'as-select-surface',
  setup: setupSelectSurface,
});

export default definePrototype({
  name: 'base-select-surface',
  setup: setupSelectSurface,
});
