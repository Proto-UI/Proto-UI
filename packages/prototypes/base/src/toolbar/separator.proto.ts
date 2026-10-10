import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { TOOLBAR_CONTEXT, TOOLBAR_FAMILY } from './shared';
import type {
  ToolbarSeparatorProps,
  ToolbarSeparatorExposes,
  ToolbarSeparatorAsHookContract,
} from './types';
function setup(def: DefHandle<ToolbarSeparatorProps, ToolbarSeparatorExposes>) {
  def.anatomy.claim(TOOLBAR_FAMILY, { role: 'separator' });
  const orientation = def.state.string('orientation', 'vertical');
  const a11y = asAccessible();
  a11y.role('separator');
  a11y.state('orientation', orientation);
  def.context.subscribe(TOOLBAR_CONTEXT, (_run, ctx) =>
    orientation.set(
      ctx.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      'reason: toolbar separator cross axis'
    )
  );
  return () => null;
}
export const asToolbarSeparator = defineAsHook<
  ToolbarSeparatorProps,
  ToolbarSeparatorExposes,
  ToolbarSeparatorAsHookContract
>({ name: 'as-toolbar-separator', setup });
export default definePrototype({ name: 'base-toolbar-separator', setup });
