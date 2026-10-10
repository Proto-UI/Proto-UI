import { type DefHandle, type RunHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger, asControlLabel } from '@proto.ui/hooks';
import { CHECKBOX_GROUP_CONTEXT, CHECKBOX_GROUP_FAMILY, groupRequest } from './shared';
import type { CheckboxGroupItemProps, CheckboxGroupItemExposes } from './types';
export function setupCheckboxGroupItem(
  def: DefHandle<CheckboxGroupItemProps, CheckboxGroupItemExposes>,
  all = false
) {
  def.anatomy.claim(CHECKBOX_GROUP_FAMILY, { role: all ? 'all' : 'item' });
  asTrigger();
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ value: '', disabled: false });
  const checked = def.state.bool('checked', false),
    indeterminate = def.state.bool('indeterminate', false),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    mixed = def.state.string('mixed', 'false');
  const focus = asFocusable<CheckboxGroupItemProps>();
  focus.configure({ disabled: false });
  for (const [key, state] of Object.entries({
    checked,
    indeterminate,
    disabled,
    readOnly,
    focused: focus.focused,
    focusVisible: focus.focusVisible,
  }))
    def.expose.state(key as 'checked', state);
  const a11y = asAccessible();
  a11y.role('checkbox');
  a11y.nameFromContent();
  a11y.state('checked', mixed);
  a11y.state('disabled', disabled);
  a11y.state('readOnly', readOnly);
  let current: RunHandle<CheckboxGroupItemProps> | null = null;
  const sync = (run: RunHandle<CheckboxGroupItemProps>) => {
    current = run;
    const ctx = run.context.read(CHECKBOX_GROUP_CONTEXT);
    checked.set(
      all ? ctx.checked : ctx.value.includes(run.props.get().value ?? ''),
      'reason: group item selection'
    );
    indeterminate.set(all && ctx.indeterminate, 'reason: group mixed selection');
    mixed.set(indeterminate.get() ? 'mixed' : String(checked.get()), 'reason: group item aria');
    disabled.set(ctx.disabled || !!run.props.get().disabled, 'reason: group item disabled');
    readOnly.set(ctx.readOnly, 'reason: group item readonly');
    focus.setDisabled(disabled.get());
  };
  def.expose.method('__groupItem', () => ({
    value: current?.props.get().value ?? '',
    disabled: !!current?.props.get().disabled,
  }));
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  const activate = (run: RunHandle<CheckboxGroupItemProps>) => {
    if (!disabled.get() && !readOnly.get())
      groupRequest(run, all ? 'requestAll' : 'requestToggle', run.props.get().value ?? '');
  };
  focus.focused.watch((run, event) => {
    if (event.type === 'next') groupRequest(run, '__focus');
  });
  def.context.subscribe(CHECKBOX_GROUP_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    sync(run);
    groupRequest(run, '__itemsChanged');
  });
  def.props.watchAll((run) => {
    sync(run);
    groupRequest(run, '__itemsChanged');
  });
  def.lifecycle.onUnmounted(() => {
    current = null;
  });
  def.event.on('press.commit', (run, event) => {
    if (event.key !== 'Enter') activate(run);
  });
  def.event.onGlobal('key.down', (_run, event) => {
    if (event.key === ' ' && focus.focused.get() && !disabled.get())
      event.control.requestDefaultActionPrevention({
        reason: 'checkbox-group.space',
        source: 'base-checkbox-group',
      });
  });
  asControlLabel().target<CheckboxGroupItemProps>((run, request) => {
    if (!disabled.get() && request.isCurrent()) {
      focus.focusSelf({ reason: 'pointer' });
      if (request.isCurrent()) activate(run);
    }
  });
  return (r: RendererHandle<any>) => r.slot();
}
