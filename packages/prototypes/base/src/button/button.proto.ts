import type { DefHandle } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';
import type { ButtonAsHookContract, ButtonExposes, ButtonProps, ButtonStateHandles } from './types';

export type { ButtonProps, ButtonExposes, ButtonStateHandles, ButtonAsHookContract } from './types';

function setupButton(def: DefHandle<ButtonProps, ButtonExposes>): void {
  // P-BASE-BUTTON-TRIGGER-SEMANTICS, P-BASE-BUTTON-NESTED-TRIGGER-ROUTE
  asTrigger();

  // P-BASE-BUTTON-PROP-DISABLED
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    disabled: false,
  });

  // P-BASE-BUTTON-DISABLED-EXPOSE
  const disabled = def.state.bool('disabled', false);
  def.expose.state('disabled', disabled);
  def.a11y.state('disabled', disabled);

  // P-BASE-BUTTON-POINTER-HOVER
  const hovered = def.state.bool('hovered', false);
  def.expose.state('hovered', hovered);

  // P-BASE-BUTTON-FOCUSABLE, P-BASE-BUTTON-DISABLED-REJECT-FOCUS
  const focusable = asFocusable<ButtonProps>();
  focusable.configure({ disabled: false });

  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  // P-BASE-BUTTON-FOCUSABLE
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);

  // P-BASE-BUTTON-REQUEST-FOCUS, P-BASE-BUTTON-DISABLED-REJECT-FOCUS
  def.expose.method('focusSelf', (options) => {
    if (disabled.get()) return;
    focusable.focusSelf(options);
  });

  // P-BASE-BUTTON-PRESS-LIFECYCLE
  const pressed = def.state.bool('pressed', false);
  def.expose.state('pressed', pressed);

  const clearTransientInteraction = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };

  // P-BASE-BUTTON-PROP-DISABLED-CONTROLLED, P-BASE-BUTTON-DISABLED-CLEAR-TRANSIENT
  const syncDisabled = (nextDisabled: boolean) => {
    disabled.set(nextDisabled, 'reason: sync disabled');
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) {
      clearTransientInteraction('reason: button disabled => reset transient interaction');
    }
  };
  def.lifecycle.onCreated((run) => {
    syncDisabled(run.props.get().disabled);
  });
  def.props.watch(['disabled'], (_run, next) => {
    syncDisabled(next.disabled);
  });

  // P-BASE-BUTTON-CLICK-SIGNAL, P-BASE-BUTTON-CLICK-PROTOCOL-NAME
  def.expose.event('click', { payload: 'void' });
  // P-BASE-BUTTON-ROLE-COMMAND
  def.a11y.action('activate', { event: 'click' });

  // P-BASE-BUTTON-ACCESSIBLE-ROLE
  def.a11y.role('button');

  // P-BASE-BUTTON-ACCESSIBLE-NAME, P-BASE-BUTTON-CONTENT-LABEL-SOURCE
  def.a11y.nameFromContent();

  // P-BASE-BUTTON-KEYBOARD-ACTIVATION, P-BASE-BUTTON-KEYBOARD-SPACE-PREVENT-DEFAULT,
  // HC-DEFAULT-ACTION-0001: prevention is requested through the portable
  // control facade, never through a raw host preventDefault function.
  def.event.onGlobal('key.down', (_run, ev) => {
    const detail = ev;
    if (disabled.get()) return;
    if (!focused.get()) return;
    if (detail?.key !== ' ') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'button.space-activation',
      source: 'base-button',
    });
  });

  // P-BASE-BUTTON-POINTER-HOVER
  def.event.on('pointer.enter', () => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: button pointer.enter => hovered');
  });
  def.event.on('pointer.leave', () => {
    hovered.set(false, 'reason: button pointer.leave => hovered');
    pressed.set(false, 'reason: button pointer.leave => pressed');
  });
  def.event.on('pointer.cancel', () => {
    hovered.set(false, 'reason: button pointer.cancel => hovered');
    pressed.set(false, 'reason: button pointer.cancel => pressed');
  });

  // P-BASE-BUTTON-PRESS-LIFECYCLE
  def.event.on('pointer.down', () => {
    if (disabled.get()) return;
    pressed.set(true, 'reason: button pointer.down => pressed');
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: button pointer.up => pressed');
  });

  // P-BASE-BUTTON-ROLE-COMMAND, P-BASE-BUTTON-DISABLED-SUPPRESS-ACTIVATION
  def.event.on('press.commit', (run) => {
    pressed.set(false, 'reason: button press.commit => pressed');
    if (disabled.get()) return;
    run.expose.emit('click');
  });

  /*
   * TODO(P-BASE-BUTTON-PROP-LABEL-DEFERRED): keep accessible naming out of core props once a11y syntax exists.
   * TODO(P-BASE-BUTTON-A11Y-ENHANCEMENT): practice optional a11y enhancements through the future a11y syntax.
   */
}

/*
 * P-BASE-BUTTON criteria outside Button-internal prototype syntax:
 * - P-BASE-BUTTON-NO-VISUAL-VARIANT-CORE: absence of visual props is the implementation.
 * - P-BASE-BUTTON-PROP-VISUAL-DEFERRED: owned by feedback/style or visual variants.
 * - P-BASE-BUTTON-ICON-CONTENT: content/styling convention, not a Button structure API.
 * - P-BASE-BUTTON-PROP-FORM-DEFERRED: awaits Form prototype cataloging.
 * - P-BASE-BUTTON-FORM-EXTENSION: awaits Form prototype cataloging.
 * - P-BASE-BUTTON-PROP-COMMAND-DEFERRED: awaits command/overlay capability cataloging.
 */

// P-BASE-BUTTON-AUTHORING-ENTRIES
export const asButton = defineAsHook<ButtonProps, ButtonExposes, ButtonAsHookContract>({
  name: 'as-button',
  setup: setupButton,
});

const button = definePrototype({
  name: 'base-button',
  setup: setupButton,
});

export default button;
