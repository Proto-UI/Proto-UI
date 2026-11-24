import { defineAsHook, definePrototype, type DefHandle, type RenderFn } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import type {
  SelectableRowAsHookContract,
  SelectableRowExposes,
  SelectableRowProps,
} from './types';

/**
 * A controlled selectable row, not a grid owner. The consumer supplies accepted
 * selection and performs activation effects; it never receives host identities.
 * Double activation is an explicit Web extension, not a portable timer heuristic.
 */
function setupSelectableRow(def: DefHandle<SelectableRowProps, SelectableRowExposes>): RenderFn {
  def.props.define({
    itemKey: { type: 'string', empty: 'fallback' },
    selected: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    activatable: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ itemKey: '', selected: false, disabled: false, activatable: false });
  const selected = def.state.bool('selected', false);
  const disabled = def.state.bool('disabled', false);
  const focus = asFocusable<SelectableRowProps>();
  focus.configure({ disabled: false });
  asTrigger();
  const accessible = asAccessible();
  accessible.role('row');
  accessible.nameFromContent();
  accessible.state('selected', selected);
  accessible.state('disabled', disabled);
  accessible.action('activate');
  def.expose.state('selected', selected);
  def.expose.state('disabled', disabled);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.event('selectionChange', { payload: 'json' });
  def.expose.event('activate', { payload: 'json' });
  def.expose.method('focusSelf', () => {
    if (!disabled.get()) focus.focusSelf();
  });
  let revision = 0;
  const sync = (props: SelectableRowProps) => {
    const current = ++revision;
    focus.setDisabled(!!props.disabled);
    if (current !== revision) return;
    disabled.set(!!props.disabled, 'row availability');
    if (current !== revision) return;
    selected.set(!!props.selected, 'accepted row selection');
  };
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watch(['selected', 'disabled'], (_run, props) => sync(props));
  def.lifecycle.onBeforeDispose(() => {
    revision++;
  });
  def.event.on('key.down', (run, event) => {
    if (disabled.get() || !focus.focused.get()) return;
    if (event.key === ' ' || (event.key === 'Enter' && run.props.get().activatable)) {
      event.control.requestDefaultActionPrevention({
        reason: 'selectable-row.keyboard',
        source: 'base-selectable-row',
      });
    }
  });
  def.event.on('press.commit', (run, event) => {
    if (disabled.get() || event.repeat) return;
    if (event.key === 'Enter') {
      if (run.props.get().activatable)
        run.expose.emit('activate', { value: run.props.get().itemKey ?? '' });
      return;
    }
    run.expose.emit('selectionChange', { value: run.props.get().itemKey ?? '' });
  });
  def.event.on('host:dblclick', (run) => {
    if (!disabled.get() && run.props.get().activatable)
      run.expose.emit('activate', { value: run.props.get().itemKey ?? '' });
  });
  return (render) => render.slot();
}

export const asSelectableRow = defineAsHook<
  SelectableRowProps,
  SelectableRowExposes,
  SelectableRowAsHookContract
>({
  name: 'as-selectable-row',
  setup: setupSelectableRow,
});

export default definePrototype<SelectableRowProps, SelectableRowExposes>({
  name: 'base-selectable-row',
  setup: setupSelectableRow,
});
