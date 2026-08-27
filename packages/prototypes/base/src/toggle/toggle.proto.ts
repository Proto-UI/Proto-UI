import type { DefHandle } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';
import type { ToggleAsHookContract, ToggleExposes, ToggleProps, ToggleStateHandles } from './types';

export type { ToggleProps, ToggleExposes, ToggleStateHandles, ToggleAsHookContract } from './types';

function setupToggle(def: DefHandle<ToggleProps, ToggleExposes>): void {
  // P-BASE-TOGGLE-ROLE-ACTIVE-CONTROL, P-BASE-TOGGLE-PROTOCOL-INDEPENDENCE
  // P-BASE-TOGGLE-TRIGGER-SEMANTICS
  asTrigger();

  // P-BASE-TOGGLE-PROP-ACTIVE, P-BASE-TOGGLE-PROP-DEFAULT-ACTIVE
  // P-BASE-TOGGLE-PROP-DISABLED, P-BASE-TOGGLE-PROP-NO-EVENT-CALLBACK
  def.props.define({
    active: { type: 'boolean', empty: 'fallback' },
    defaultActive: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultActive: false,
    disabled: false,
  });

  // P-BASE-TOGGLE-ACTIVE-EXPOSE, P-BASE-TOGGLE-ACTIVE-SCOPED-NAME
  // P-BASE-TOGGLE-ACTIVE-NOT-CHECKED, P-BASE-TOGGLE-ACTIVE-NOT-TRANSIENT-PRESSED
  const active = def.state.bool('active', false);
  // P-BASE-TOGGLE-DISABLED-EXPOSE
  const disabled = def.state.bool('disabled', false);
  // P-BASE-TOGGLE-POINTER-HOVER
  const hovered = def.state.bool('hovered', false);
  // P-BASE-TOGGLE-PRESS-LIFECYCLE
  const pressed = def.state.bool('pressed', false);
  // P-BASE-TOGGLE-FOCUSABLE, P-BASE-TOGGLE-DISABLED-REJECT-FOCUS
  const focusable = asFocusable<ToggleProps>();
  focusable.configure({ disabled: false });

  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('active', active);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);
  // P-BASE-TOGGLE-REQUEST-FOCUS, P-BASE-TOGGLE-DISABLED-REJECT-FOCUS
  def.expose.method('focusSelf', (options) => {
    if (disabled.get()) return;
    focusable.focusSelf(options);
  });
  // P-BASE-TOGGLE-ACTIVE-CHANGE-SIGNAL, P-BASE-TOGGLE-ACTIVE-CHANGE-PROTOCOL-NAME
  def.expose.event('activeChange', { payload: 'json' });

  // P-BASE-TOGGLE-ACCESSIBLE-ROLE
  def.a11y.role('button');
  // P-BASE-TOGGLE-ACCESSIBLE-NAME
  def.a11y.nameFromContent();
  // P-BASE-TOGGLE-A11Y-PRESSED
  def.a11y.state('pressed', active);
  def.a11y.state('disabled', disabled);
  def.a11y.action('activate', { event: 'activeChange' });

  let controlled = false;

  const clearTransientInteraction = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };

  // P-BASE-TOGGLE-DISABLED-EXPOSE, P-BASE-TOGGLE-DISABLED-CLEAR-TRANSIENT
  const syncDisabled = (nextDisabled: boolean) => {
    disabled.set(nextDisabled, 'reason: toggle sync disabled');
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) {
      clearTransientInteraction('reason: toggle disabled => reset transient interaction');
    }
  };

  // P-BASE-TOGGLE-CONTROLLED-ACTIVE, P-BASE-TOGGLE-CONTROLLED-EMITS-NEXT
  // P-BASE-TOGGLE-UNCONTROLLED-UPDATES-ACTIVE
  def.lifecycle.onCreated((run) => {
    controlled = run.props.isProvided('active');
    active.set(
      controlled ? !!run.props.get().active : !!run.props.get().defaultActive,
      'reason: toggle initialize active'
    );
    syncDisabled(!!run.props.get().disabled);
  });

  // P-BASE-TOGGLE-CONTROLLED-ACTIVE
  def.props.watch(['active'], (run, next) => {
    controlled = run.props.isProvided('active');
    if (!controlled) return;
    active.set(!!next.active, 'reason: toggle controlled active sync');
  });

  // P-BASE-TOGGLE-DISABLED-EXPOSE, P-BASE-TOGGLE-DISABLED-CLEAR-TRANSIENT
  def.props.watch(['disabled'], (_run, next) => {
    syncDisabled(!!next.disabled);
  });

  // P-BASE-TOGGLE-KEYBOARD-ACTIVATION, P-BASE-TOGGLE-KEYBOARD-SPACE-PREVENT-DEFAULT
  def.event.onGlobal('key.down', (_run, ev) => {
    const detail = ev;
    if (disabled.get()) return;
    if (!focused.get()) return;
    if (detail?.key !== ' ') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'toggle.space-activation',
      source: 'base-toggle',
    });
  });

  // P-BASE-TOGGLE-POINTER-HOVER
  def.event.on('pointer.enter', () => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: toggle pointer.enter => hovered');
  });
  def.event.on('pointer.leave', () => {
    hovered.set(false, 'reason: toggle pointer.leave => hovered');
    pressed.set(false, 'reason: toggle pointer.leave => pressed');
  });
  def.event.on('pointer.cancel', () => {
    hovered.set(false, 'reason: toggle pointer.cancel => hovered');
    pressed.set(false, 'reason: toggle pointer.cancel => pressed');
  });

  // P-BASE-TOGGLE-PRESS-LIFECYCLE
  def.event.on('pointer.down', () => {
    if (disabled.get()) return;
    pressed.set(true, 'reason: toggle pointer.down => pressed');
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: toggle pointer.up => pressed');
  });

  // P-BASE-TOGGLE-ACTIVATION-FLIPS-ACTIVE, P-BASE-TOGGLE-DISABLED-SUPPRESS-ACTIVATION
  // P-BASE-TOGGLE-UNCONTROLLED-UPDATES-ACTIVE, P-BASE-TOGGLE-CONTROLLED-EMITS-NEXT
  def.event.on('press.commit', (run) => {
    pressed.set(false, 'reason: toggle press.commit => pressed');
    if (disabled.get()) return;

    const nextActive = !active.get();
    if (!controlled) {
      active.set(nextActive, 'reason: toggle press.commit => active');
    }
    run.expose.emit('activeChange', { active: nextActive });
  });
}

/*
 * P-BASE-TOGGLE criteria outside Toggle-internal prototype syntax:
 * - P-BASE-TOGGLE-SINGLE-SUBJECT: absence of group membership and collection syntax is the implementation.
 * - P-BASE-TOGGLE-NO-ANATOMY-PARTS: absence of anatomy roles is the implementation.
 * - P-BASE-TOGGLE-CLICK-DEFERRED: absence of a `click` expose event is the implementation.
 * - P-BASE-TOGGLE-PROP-LABEL-DEFERRED: accessible naming uses content/a11y projection; no `label` prop is accepted.
 * - P-BASE-TOGGLE-NO-FORM-INTEGRATION: no form props or form submission surface are accepted.
 * - P-BASE-TOGGLE-NO-VISUAL-VARIANT-CORE: visual parameters are owned by downstream styled prototypes.
 */

// P-BASE-TOGGLE-AUTHORING-ENTRIES
export const asToggle = defineAsHook<ToggleProps, ToggleExposes, ToggleAsHookContract>({
  name: 'as-toggle',
  setup: setupToggle,
});

const toggle = definePrototype({
  name: 'base-toggle',
  setup: setupToggle,
});

export default toggle;
