import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { SELECT_CONTEXT, SELECT_FAMILY } from './shared';
import type { SelectValueAsHookContract, SelectValueExposes, SelectValueProps } from './types';

function setupSelectValue(def: DefHandle<SelectValueProps, SelectValueExposes>) {
  def.anatomy.claim(SELECT_FAMILY, { role: 'value' });
  def.props.define({ placeholder: { type: 'string', empty: 'fallback' } });
  def.props.setDefaults({ placeholder: '' });
  def.feedback.style.use(tw('pointer-events-none'));

  const displayValue = def.state.string('displayValue', '');
  def.expose.state('displayValue', displayValue);
  let mounted = false;
  // A context update can resolve the selected text before this view is mounted,
  // in which case the render that would have shown it is suppressed. Remember
  // that so mounting can flush it, or the host keeps painting the earlier value
  // while the exposed state already reads the resolved one.
  let renderMissed = false;

  const computeDisplayValue = (run: any) => {
    const ctx = run.context.read(SELECT_CONTEXT);
    return ctx.textValue || ctx.value || run.props.get().placeholder || '';
  };

  const syncDisplayValue = (run: any, requestRender: boolean) => {
    const nextValue = computeDisplayValue(run);
    if (nextValue === displayValue.get()) return;
    displayValue.set(nextValue, 'reason: select value display sync');
    if (!requestRender) return;
    if (mounted) run.update();
    else renderMissed = true;
  };

  def.context.subscribe(SELECT_CONTEXT, (run) => syncDisplayValue(run, true));
  def.lifecycle.onCreated((run) => syncDisplayValue(run, false));
  def.lifecycle.onMounted((run) => {
    syncDisplayValue(run, false);
    mounted = true;
    if (renderMissed) {
      renderMissed = false;
      run.update();
    }
  });
  def.props.watch(['placeholder'], (run) => syncDisplayValue(run, true));
  def.lifecycle.onUnmounted(() => {
    mounted = false;
  });

  return () => (displayValue.get() ? [displayValue.get()] : null);
}

export const asSelectValue = defineAsHook<
  SelectValueProps,
  SelectValueExposes,
  SelectValueAsHookContract
>({
  name: 'as-select-value',
  setup: setupSelectValue,
});

const selectValue = definePrototype({ name: 'base-select-value', setup: setupSelectValue });

export default selectValue;
