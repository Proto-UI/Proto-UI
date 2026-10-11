import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { FIELDSET_CONTEXT, FIELDSET_FAMILY } from './shared';
import type { FieldsetPartProps, FieldsetRootExposes, FieldsetAsHookContract } from './types';
function setup(def: DefHandle<FieldsetPartProps, FieldsetRootExposes>) {
  def.anatomy.claim(FIELDSET_FAMILY, { role: 'description' });
  asAccessible().part(FIELDSET_FAMILY, { key: 'description' });
  const disabled = def.state.bool('disabled', false);
  def.expose.state('disabled', disabled);
  const sync = (run: import('@proto.ui/core').RunHandle<FieldsetPartProps>) =>
    disabled.set(run.context.read(FIELDSET_CONTEXT).disabled, 'reason: fieldset part policy');
  def.context.subscribe(FIELDSET_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return (r: RendererHandle<any>) => r.slot();
}
export const asFieldsetDescription = defineAsHook<
  FieldsetPartProps,
  FieldsetRootExposes,
  FieldsetAsHookContract
>({ name: 'as-fieldset-description', setup });
export default definePrototype({ name: 'base-fieldset-description', setup });
