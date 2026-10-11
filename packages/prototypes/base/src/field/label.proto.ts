import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible, asControlLabel } from '@proto.ui/hooks';
import { FIELD_CONTEXT, FIELD_FAMILY, FIELD_LABEL_PAIR, rejectFieldDuplicates } from './shared';
import type { FieldLabelProps, FieldLabelExposes, FieldLabelAsHookContract } from './types';
function setup(def: DefHandle<FieldLabelProps, FieldLabelExposes>) {
  def.anatomy.claim(FIELD_FAMILY, { role: 'label' });
  def.props.define({ activation: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ activation: true });
  const label = asControlLabel().label(FIELD_LABEL_PAIR);
  const disabled = def.state.bool('disabled', false),
    required = def.state.bool('required', false);
  def.expose.state('disabled', disabled);
  def.expose.state('required', required);
  asAccessible().part(FIELD_FAMILY, { key: 'label' });
  const sync = (run: import('@proto.ui/core').RunHandle<FieldLabelProps>) => {
    rejectFieldDuplicates(run, 'label');
    const ctx = run.context.read(FIELD_CONTEXT);
    label.sync({
      naming: false,
      activation: run.props.get().activation !== false && !ctx.disabled,
    });
    disabled.set(ctx.disabled, 'reason: field label disabled');
    required.set(ctx.required, 'reason: field label required');
  };
  def.context.subscribe(FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onUpdated(sync);
  def.props.watch(['activation'], sync);
  return (r: import('@proto.ui/core').RendererHandle<any>) => r.slot();
}
export const asFieldLabel = defineAsHook<
  FieldLabelProps,
  FieldLabelExposes,
  FieldLabelAsHookContract
>({ name: 'as-field-label', setup });
export default definePrototype({ name: 'base-field-label', setup });
