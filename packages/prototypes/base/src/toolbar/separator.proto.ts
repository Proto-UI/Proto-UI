import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { TOOLBAR_CONTEXT, TOOLBAR_FAMILY, type ToolbarContext } from './shared';
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
  const sync = (_run: RunHandle<ToolbarSeparatorProps>, ctx: ToolbarContext) =>
    orientation.set(
      ctx.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      'reason: toolbar separator cross axis'
    );
  def.context.subscribe(TOOLBAR_CONTEXT, sync);
  def.lifecycle.onCreated((run) => sync(run, run.context.read(TOOLBAR_CONTEXT)));
  def.lifecycle.onMounted((run) => sync(run, run.context.read(TOOLBAR_CONTEXT)));
  def.anatomy.subscribeParts(TOOLBAR_FAMILY, 'root', (run, parts) => {
    if (parts.length) sync(run, run.context.read(TOOLBAR_CONTEXT));
  });
  return () => null;
}
export const asToolbarSeparator = defineAsHook<
  ToolbarSeparatorProps,
  ToolbarSeparatorExposes,
  ToolbarSeparatorAsHookContract
>({ name: 'as-toolbar-separator', setup });
export default definePrototype({ name: 'base-toolbar-separator', setup });
