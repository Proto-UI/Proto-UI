import {
  CONTROL_LABEL_SELECTION_POLICIES,
  defineAsHook,
  definePrototype,
  tw,
  type DefHandle,
  type RenderFn,
} from '@proto.ui/core';
import { asControlLabel } from '@proto.ui/hooks';
import type { LabelRootProps, LabelRootExposes } from './types';
function setupLabel(def: DefHandle<LabelRootProps, LabelRootExposes>): RenderFn {
  def.props.define({
    naming: { type: 'boolean', empty: 'fallback' },
    activation: { type: 'boolean', empty: 'fallback' },
    selection: { type: 'enum', options: [...CONTROL_LABEL_SELECTION_POLICIES], empty: 'fallback' },
  });
  def.props.setDefaults({ naming: true, activation: false, selection: 'policy' });
  const label = asControlLabel().label();
  const sync = (props: LabelRootProps) =>
    label.sync({ naming: props.naming !== false, activation: props.activation === true });
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watch(['naming', 'activation'], (_run, next) => sync(next));
  def.rule({
    when: (w) => w.all(w.prop('selection').eq('policy'), w.prop('activation').eq(true)),
    intent: (i) => i.feedback.style.use(tw('select-none')),
  });
  // Explicit overrides are subject-local affordance declarations, not a second
  // selection state machine; the shared semantic group keeps them last-wins.
  def.rule({
    when: (w) => w.prop('selection').eq('auto'),
    intent: (i) => i.feedback.style.use(tw('select-auto')),
  });
  def.rule({
    when: (w) => w.prop('selection').eq('text'),
    intent: (i) => i.feedback.style.use(tw('select-text')),
  });
  def.rule({
    when: (w) => w.prop('selection').eq('none'),
    intent: (i) => i.feedback.style.use(tw('select-none')),
  });
  return (renderer) => [renderer.r.slot()];
}
export const asLabelRoot = defineAsHook<LabelRootProps, LabelRootExposes>({
  name: 'as-label-root',
  setup: setupLabel,
});
export default definePrototype<LabelRootProps, LabelRootExposes>({
  name: 'base-label-root',
  setup: setupLabel,
});
