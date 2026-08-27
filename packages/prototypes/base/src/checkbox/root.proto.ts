import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';
import { CHECKBOX_CONTEXT, CHECKBOX_FAMILY } from './shared';
import type { CheckboxRootAsHookContract, CheckboxRootExposes, CheckboxRootProps } from './types';

function isEnterKeyboardCommit(ev: { key?: unknown } | undefined): boolean {
  return ev?.key === 'Enter';
}

function setupCheckboxRoot(def: DefHandle<CheckboxRootProps, CheckboxRootExposes>): void {
  // P-BASE-CHECKBOX-ROLE-CHECKED-INPUT, P-BASE-CHECKBOX-DISPLAY-AND-INPUT
  // P-BASE-CHECKBOX-ROOT-SEMANTIC-OWNER
  // P-BASE-CHECKBOX-ROOT-DOMAIN-ANCHOR
  def.anatomy.claim(CHECKBOX_FAMILY, { role: 'root' });

  // P-BASE-CHECKBOX-PROTOCOL-INDEPENDENCE, P-BASE-CHECKBOX-TRIGGER-SEMANTICS
  asTrigger();

  // P-BASE-CHECKBOX-PROP-CHECKED, P-BASE-CHECKBOX-PROP-DEFAULT-CHECKED
  // P-BASE-CHECKBOX-PROP-DISABLED, P-BASE-CHECKBOX-PROP-NO-EVENT-CALLBACK
  def.props.define({
    checked: { type: 'boolean', empty: 'fallback' },
    defaultChecked: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    indeterminate: { type: 'boolean', empty: 'fallback' },
    defaultIndeterminate: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultChecked: false,
    disabled: false,
    defaultIndeterminate: false,
  });

  // P-BASE-CHECKBOX-CHECKED-EXPOSE, P-BASE-CHECKBOX-DISABLED-EXPOSE
  const checked = def.state.bool('checked', false);
  const disabled = def.state.bool('disabled', false);
  // P-BASE-CHECKBOX-POINTER-HOVER
  const hovered = def.state.bool('hovered', false);
  // P-BASE-CHECKBOX-PRESS-LIFECYCLE
  const pressed = def.state.bool('pressed', false);
  // P-BASE-CHECKBOX-INDETERMINATE-STATE, P-BASE-CHECKBOX-INDETERMINATE-AUTHOR-CAPABILITY
  const indeterminate = def.state.bool('indeterminate', false);
  // P-BASE-CHECKBOX-A11Y-CHECKED, P-BASE-CHECKBOX-A11Y-MIXED
  const checkedA11y = def.state.string('checkedA11y', 'false', {
    options: ['true', 'false', 'mixed'],
  });
  // P-BASE-CHECKBOX-FOCUSABLE, P-BASE-CHECKBOX-DISABLED-REJECT-FOCUS
  const focusable = asFocusable<CheckboxRootProps>();
  focusable.configure({ disabled: false });

  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('checked', checked);
  def.expose.state('indeterminate', indeterminate);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);
  // P-BASE-CHECKBOX-REQUEST-FOCUS, P-BASE-CHECKBOX-DISABLED-REJECT-FOCUS
  def.expose.method('focusSelf', (options) => {
    if (disabled.get()) return;
    focusable.focusSelf(options);
  });
  // P-BASE-CHECKBOX-CHECKED-CHANGE-SIGNAL, P-BASE-CHECKBOX-CHECKED-CHANGE-PROTOCOL-NAME
  def.expose.event('checkedChange', { payload: 'json' });
  def.expose.event('indeterminateChange', { payload: 'json' });

  // P-BASE-CHECKBOX-ACCESSIBLE-ROLE
  def.a11y.role('checkbox');
  // P-BASE-CHECKBOX-ACCESSIBLE-NAME, P-BASE-CHECKBOX-STABLE-LABEL
  def.a11y.nameFromContent();
  // P-BASE-CHECKBOX-A11Y-CHECKED, P-BASE-CHECKBOX-A11Y-MIXED
  def.a11y.state('checked', checkedA11y);
  def.a11y.state('disabled', disabled);
  def.a11y.action('activate', { event: 'checkedChange' });

  let controlledChecked = false;
  let controlledIndeterminate = false;

  def.context.provide(CHECKBOX_CONTEXT, {
    checked: false,
    indeterminate: false,
    disabled: false,
  });

  const publishContext = (run: any) => {
    // P-BASE-CHECKBOX-CONTEXT-SYNC, P-BASE-CHECKBOX-PART-CONTEXT-CONSUME
    checkedA11y.set(
      indeterminate.get() ? 'mixed' : checked.get() ? 'true' : 'false',
      'reason: checkbox root sync a11y checked'
    );
    run.context.update(CHECKBOX_CONTEXT, {
      checked: !!checked.get(),
      indeterminate: !!indeterminate.get(),
      disabled: !!disabled.get(),
    });
  };

  const emitCheckedChange = (run: any, detail: { checked: boolean; indeterminate: boolean }) => {
    run.expose.emit('checkedChange', detail);
  };

  const clearTransientInteraction = (reason: string) => {
    hovered.set(false, reason);
    pressed.set(false, reason);
  };

  const syncDisabled = (run: any, nextDisabled: boolean) => {
    disabled.set(nextDisabled, 'reason: checkbox root sync disabled');
    focusable.setDisabled(nextDisabled);
    if (nextDisabled) {
      clearTransientInteraction('reason: checkbox root disabled => reset transient interaction');
    }
    publishContext(run);
  };

  // P-BASE-CHECKBOX-CONTROLLED-CHECKED, P-BASE-CHECKBOX-CONTROLLED-EMITS-NEXT
  // P-BASE-CHECKBOX-UNCONTROLLED-UPDATES-CHECKED
  def.lifecycle.onCreated((run) => {
    controlledChecked = run.props.isProvided('checked');
    controlledIndeterminate = run.props.isProvided('indeterminate');
    checked.set(
      controlledChecked ? !!run.props.get().checked : !!run.props.get().defaultChecked,
      'reason: checkbox root initialize checked'
    );
    indeterminate.set(
      controlledIndeterminate
        ? !!run.props.get().indeterminate
        : !!run.props.get().defaultIndeterminate,
      'reason: checkbox root initialize indeterminate'
    );
    syncDisabled(run, !!run.props.get().disabled);
  });

  def.lifecycle.onMounted((run) => {
    publishContext(run);
  });

  // P-BASE-CHECKBOX-CONTROLLED-CHECKED
  def.props.watch(['checked'], (run, next) => {
    controlledChecked = run.props.isProvided('checked');
    if (!controlledChecked) return;
    checked.set(!!next.checked, 'reason: checkbox root controlled checked sync');
    publishContext(run);
  });

  def.props.watch(['indeterminate'], (run, next) => {
    controlledIndeterminate = run.props.isProvided('indeterminate');
    if (controlledIndeterminate) {
      indeterminate.set(
        !!next.indeterminate,
        'reason: checkbox root controlled indeterminate sync'
      );
    }
    publishContext(run);
  });

  // P-BASE-CHECKBOX-DISABLED-EXPOSE, P-BASE-CHECKBOX-DISABLED-CLEAR-TRANSIENT
  def.props.watch(['disabled'], (run, next) => {
    syncDisabled(run, !!next.disabled);
  });

  // P-BASE-CHECKBOX-KEYBOARD-SPACE-ACTIVATION, P-BASE-CHECKBOX-KEYBOARD-ENTER-NOT-ACTIVATION
  // P-BASE-CHECKBOX-KEYBOARD-SPACE-PREVENT-DEFAULT
  def.event.onGlobal('key.down', (_run, ev) => {
    const detail = ev;
    if (disabled.get()) return;
    if (!focused.get()) return;
    if (detail?.key !== ' ') return;
    ev.control.requestDefaultActionPrevention({
      reason: 'checkbox.space-activation',
      source: 'base-checkbox',
    });
  });

  // P-BASE-CHECKBOX-POINTER-HOVER
  def.event.on('pointer.enter', () => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: checkbox root pointer.enter => hovered');
  });
  def.event.on('pointer.leave', () => {
    hovered.set(false, 'reason: checkbox root pointer.leave => hovered');
    pressed.set(false, 'reason: checkbox root pointer.leave => pressed');
  });
  def.event.on('pointer.cancel', () => {
    hovered.set(false, 'reason: checkbox root pointer.cancel => hovered');
    pressed.set(false, 'reason: checkbox root pointer.cancel => pressed');
  });

  // P-BASE-CHECKBOX-PRESS-LIFECYCLE
  def.event.on('pointer.down', () => {
    if (disabled.get()) return;
    pressed.set(true, 'reason: checkbox root pointer.down => pressed');
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: checkbox root pointer.up => pressed');
  });

  // P-BASE-CHECKBOX-ACTIVATION-FLIPS-CHECKED, P-BASE-CHECKBOX-ACTIVATION-CLEARS-INDETERMINATE
  // P-BASE-CHECKBOX-DISABLED-SUPPRESS-ACTIVATION
  def.event.on('press.commit', (run, ev) => {
    pressed.set(false, 'reason: checkbox root press.commit => pressed');
    if (disabled.get()) return;
    if (isEnterKeyboardCommit(ev)) return;

    const wasIndeterminate = indeterminate.get();
    if (wasIndeterminate) {
      if (!controlledIndeterminate) {
        indeterminate.set(false, 'reason: press.commit => clear indeterminate');
      }
      run.expose.emit('indeterminateChange', { indeterminate: false });
    }

    const nextChecked = !checked.get();
    const nextIndeterminate = wasIndeterminate ? false : indeterminate.get();

    if (controlledChecked) {
      emitCheckedChange(run, { checked: nextChecked, indeterminate: nextIndeterminate });
      publishContext(run);
      return;
    }

    checked.set(nextChecked, 'reason: press.commit => toggle checked');
    emitCheckedChange(run, { checked: nextChecked, indeterminate: nextIndeterminate });
    publishContext(run);
  });
}

/*
 * P-BASE-CHECKBOX criteria outside Checkbox-root-internal prototype syntax:
 * - P-BASE-CHECKBOX-CLICK-DEFERRED: absence of a `click` expose event is the implementation.
 * - P-BASE-CHECKBOX-INDICATOR-PRESENTATIONAL-A11Y: owned by root semantics and indicator's absence of a11y control syntax.
 * - P-BASE-CHECKBOX-INDETERMINATE-PROP-DEFERRED: checked/defaultChecked remain core; indeterminate props are current advanced compatibility surface pending decision.
 * - P-BASE-CHECKBOX-INDETERMINATE-CHANGE-DEFERRED: `indeterminateChange` remains transitional because controlled direct props need a clear request path.
 * - P-BASE-CHECKBOX-INDETERMINATE-AUTHOR-CAPABILITY: asHook returns the indeterminate state handle; arbitrary post-mounted external state writes still need a future state observation or explicit sync capability to publish context immediately.
 * - P-BASE-CHECKBOX-PROP-LABEL-DEFERRED: accessible naming uses content/a11y projection; no `label` prop is accepted.
 * - P-BASE-CHECKBOX-FORM-INTEGRATION-DEFERRED: awaits Form prototype cataloging.
 * - P-BASE-CHECKBOX-NO-VISUAL-VARIANT-CORE: visual parameters are owned by downstream styled prototypes.
 * - P-BASE-CHECKBOX-AGGREGATE-DEFERRED: group/tree summary modeling is deferred beyond this atomic checkbox.
 */

// P-BASE-CHECKBOX-AUTHORING-ENTRIES
export const asCheckboxRoot = defineAsHook<
  CheckboxRootProps,
  CheckboxRootExposes,
  CheckboxRootAsHookContract
>({
  name: 'as-checkbox-root',
  setup: setupCheckboxRoot,
});

const checkboxRoot = definePrototype({
  name: 'base-checkbox-root',
  setup: setupCheckboxRoot,
});

export default checkboxRoot;
