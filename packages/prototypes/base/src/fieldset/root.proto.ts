import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { FIELDSET_CONTEXT, FIELDSET_FAMILY } from './shared';
import type { FieldsetRootProps, FieldsetRootExposes, FieldsetAsHookContract } from './types';
function setup(def: DefHandle<FieldsetRootProps, FieldsetRootExposes>) {
  def.anatomy.claim(FIELDSET_FAMILY, { role: 'root' });
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, ariaLabel: '' });
  const disabled = def.state.bool('disabled', false),
    label = def.state.string('label', '');
  def.expose.state('disabled', disabled);
  const a = asAccessible();
  a.role('group');
  a.name(label);
  a.state('disabled', disabled);
  a.relation('labelledBy', {
    target: { kind: 'part', family: FIELDSET_FAMILY, role: 'legend', key: 'legend' },
  });
  a.relation('describedBy', {
    target: { kind: 'part', family: FIELDSET_FAMILY, role: 'description', key: 'description' },
  });
  def.context.provide(FIELDSET_CONTEXT, { disabled: false });
  const sync = (run: import('@proto.ui/core').RunHandle<FieldsetRootProps>) => {
    disabled.set(!!run.props.get().disabled, 'reason: fieldset disabled');
    label.set(run.props.get().ariaLabel ?? '', 'reason: fieldset name');
    run.context.update(FIELDSET_CONTEXT, { disabled: disabled.get() });
  };
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  return (r: RendererHandle<any>) => r.slot();
}
export const asFieldsetRoot = defineAsHook<
  FieldsetRootProps,
  FieldsetRootExposes,
  FieldsetAsHookContract
>({ name: 'as-fieldset-root', setup });
export default definePrototype({ name: 'base-fieldset-root', setup });
