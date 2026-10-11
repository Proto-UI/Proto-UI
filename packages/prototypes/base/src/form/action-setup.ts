import type { DefHandle, RendererHandle, RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import { FORM_CONTEXT, FORM_FAMILY, formMethod } from './shared';
import type { FormActionExposes, FormActionProps } from './types';

/** Form owns activation. Shared privileged input/focus capabilities do not add a Button owner. */
export function setupFormAction(
  def: DefHandle<FormActionProps, FormActionExposes>,
  action: 'submit' | 'reset'
) {
  def.anatomy.claim(FORM_FAMILY, { role: action });
  asTrigger();
  const focus = asFocusable<FormActionProps>();
  focus.configure({ disabled: false });
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });
  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('pressed', pressed);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  const a = asAccessible();
  a.role('button');
  a.nameFromContent();
  a.state('disabled', disabled);
  const clear = () => {
    hovered.set(false, 'reason: form action clear hover');
    pressed.set(false, 'reason: form action cancel press');
  };
  const sync = (run: RunHandle<FormActionProps>) => {
    const ctx = run.context.read(FORM_CONTEXT);
    const next = ctx.disabled || !!run.props.get().disabled;
    disabled.set(next, 'reason: form action effective policy');
    focus.setDisabled(next);
    if (next) clear();
  };
  def.context.subscribe(FORM_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(clear);
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'reason: form action pointer enter');
  });
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.event.on('press.cancel', clear);
  def.event.on('pointer.down', () => {
    if (!disabled.get()) pressed.set(true, 'reason: form action pointer down');
  });
  def.event.on('pointer.up', () => pressed.set(false, 'reason: form action pointer up'));
  focus.focused.watch((_run, event) => {
    if (event.type === 'next' && !event.next) pressed.set(false, 'reason: form action blur');
  });
  def.event.onGlobal('key.down', (_run, event) => {
    if (!disabled.get() && focus.focused.get() && event.key === ' ') {
      event.control.requestDefaultActionPrevention({
        reason: 'form.action-space',
        source: 'base-form-action',
      });
    }
  });
  def.event.on('press.commit', (run) => {
    pressed.set(false, 'reason: form action committed');
    if (!disabled.get()) formMethod(run, action === 'submit' ? 'requestSubmit' : 'requestReset');
  });
  return (r: RendererHandle<any>) => r.slot();
}
