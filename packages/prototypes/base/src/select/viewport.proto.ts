import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { SELECT_FAMILY } from './shared';

function setupSelectViewport(def: DefHandle<{}>): RenderFn {
  def.anatomy.claim(SELECT_FAMILY, { role: 'viewport' });
  return (renderer) => [renderer.r.slot()];
}

export const asSelectViewport = defineAsHook({
  name: 'as-select-viewport',
  setup: setupSelectViewport,
});

export default definePrototype({
  name: 'base-select-viewport',
  setup: setupSelectViewport,
});
