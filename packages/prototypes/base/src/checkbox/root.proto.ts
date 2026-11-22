import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger, asControlLabel } from '@proto.ui/hooks';
import { asOptionalFieldControl } from '../field/control-binding.proto';
import { createChoiceFieldReport } from '../field/choice-report';
import { FIELD_CONTEXT, FIELD_LABEL_PAIR } from '../field/shared';
import { CHECKBOX_CONTEXT, CHECKBOX_FAMILY } from './shared';
import type { CheckboxRootAsHookContract, CheckboxRootExposes, CheckboxRootProps } from './types';

export type CheckboxRootSetupOptions = Readonly<{ fieldBinding?: boolean }>;
/** One semantic owner. Field registration is an explicit definition-time composition. */
export function setupCheckboxRoot(
  def: DefHandle<CheckboxRootProps, CheckboxRootExposes>,
  options: CheckboxRootSetupOptions = {}
): void {
  const binding = options.fieldBinding ? asOptionalFieldControl() : null;
  const accessible = asAccessible();
  def.anatomy.claim(CHECKBOX_FAMILY, { role: 'root' });
  asTrigger();
  def.props.define({
    checked: { type: 'boolean', empty: 'fallback' },
    defaultChecked: { type: 'boolean', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    indeterminate: { type: 'boolean', empty: 'fallback' },
    defaultIndeterminate: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultChecked: false,
    disabled: false,
    readOnly: false,
    defaultIndeterminate: false,
  });
  const checked = def.state.bool('checked', false);
  const disabled = def.state.bool('disabled', false);
  const readOnly = def.state.bool('readOnly', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const indeterminate = def.state.bool('indeterminate', false);
  const checkedA11y = def.state.string('checkedA11y', 'false', {
    options: ['true', 'false', 'mixed'],
  });
  const focusable = asFocusable<CheckboxRootProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused,
    focusVisible = focusable.focusVisible;
  def.expose.state('checked', checked);
  def.expose.state('disabled', disabled);
  def.expose.state('readOnly', readOnly);
  def.expose.state('hovered', hovered);
  def.expose.state('pressed', pressed);
  def.expose.state('indeterminate', indeterminate);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });
  def.expose.event('checkedChange', { payload: 'json' });
  def.expose.event('indeterminateChange', { payload: 'json' });
  accessible.role('checkbox');
  accessible.nameFromContent();
  accessible.state('checked', checkedA11y);
  accessible.state('disabled', disabled);
  accessible.state('readOnly', readOnly);
  accessible.action('activate', { event: 'checkedChange' });
  def.context.provide(CHECKBOX_CONTEXT, { checked: false, indeterminate: false, disabled: false });

  let currentRun: RunHandle<CheckboxRootProps> | null = null;
  let mounted = false,
    viewEpoch = 0,
    operationEpoch = 0;
  let checkedOwnerEpoch = 0;
  let controlledChecked = false,
    controlledIndeterminate = false;
  let initialChecked = false,
    initialIndeterminate = false;
  const isCurrent = (run: RunHandle<CheckboxRootProps>, view: number, operation: number) =>
    currentRun === run && viewEpoch === view && operationEpoch === operation;
  const reportField = (reason: 'sync' | 'change' | 'blur' = 'sync') => {
    if (binding && currentRun)
      binding.report({ value: checked.get(), focused: focused.get(), composing: false, reason });
  };
  const reports = createChoiceFieldReport(
    () => !!binding && !!currentRun && mounted && !!currentRun.context.tryRead(FIELD_CONTEXT),
    () => checked.get(),
    reportField
  );
  const publish = (run: RunHandle<CheckboxRootProps>) => {
    const view = viewEpoch,
      operation = operationEpoch;
    if (currentRun !== run) return false;
    checkedA11y.set(
      indeterminate.get() ? 'mixed' : checked.get() ? 'true' : 'false',
      'reason: checkbox canonical checked'
    );
    if (!isCurrent(run, view, operation)) return false;
    run.context.update(CHECKBOX_CONTEXT, {
      checked: checked.get(),
      indeterminate: indeterminate.get(),
      disabled: disabled.get(),
    });
    return isCurrent(run, view, operation);
  };
  const syncPolicy = (run: RunHandle<CheckboxRootProps>) => {
    if (currentRun !== run) return;
    const p = run.props.get();
    const nextDisabled = binding ? binding.state.fieldDisabled.get() : !!p.disabled;
    const nextReadOnly = binding ? binding.state.fieldReadOnly.get() : !!p.readOnly;
    if (nextDisabled !== disabled.get() || nextReadOnly !== readOnly.get()) {
      operationEpoch++;
      reports.cancel();
    }
    const view = viewEpoch,
      operation = operationEpoch;
    disabled.set(nextDisabled, 'reason: checkbox effective disabled');
    if (!isCurrent(run, view, operation)) return;
    readOnly.set(nextReadOnly, 'reason: checkbox effective readonly');
    if (!isCurrent(run, view, operation)) return;
    focusable.setDisabled(nextDisabled);
    if (!isCurrent(run, view, operation)) return;
    if (nextDisabled || nextReadOnly) {
      pressed.set(false, 'reason: checkbox edit policy retired press');
      if (!isCurrent(run, view, operation)) return;
    }
    if (nextDisabled) hovered.set(false, 'reason: checkbox disabled hover');
    if (isCurrent(run, view, operation) && publish(run)) reportField();
  };
  const syncOwner = (run: RunHandle<CheckboxRootProps>) => {
    if (currentRun !== run) return;
    const view = viewEpoch,
      operation = operationEpoch,
      p = run.props.get();
    controlledChecked = run.props.isProvided('checked');
    controlledIndeterminate = run.props.isProvided('indeterminate');
    if (controlledChecked) {
      if (!!p.checked !== checked.get()) checkedOwnerEpoch++;
      checked.set(!!p.checked, 'reason: checkbox controlled checked');
    }
    if (!isCurrent(run, view, operation)) return;
    if (controlledIndeterminate)
      indeterminate.set(!!p.indeterminate, 'reason: checkbox controlled mixed');
    if (isCurrent(run, view, operation) && publish(run)) reportField();
  };
  def.lifecycle.onCreated((run) => {
    currentRun = run;
    controlledChecked = run.props.isProvided('checked');
    controlledIndeterminate = run.props.isProvided('indeterminate');
    initialChecked = controlledChecked
      ? !!run.props.get().checked
      : !!run.props.get().defaultChecked;
    initialIndeterminate = controlledIndeterminate
      ? !!run.props.get().indeterminate
      : !!run.props.get().defaultIndeterminate;
    checked.set(initialChecked, 'reason: checkbox initial canonical checked');
    indeterminate.set(initialIndeterminate, 'reason: checkbox initial canonical mixed');
    syncPolicy(run);
  });
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    mounted = true;
    syncOwner(run);
    syncPolicy(run);
  });
  const retire = () => {
    reports.cancel();
    operationEpoch++;
    viewEpoch++;
    mounted = false;
    currentRun = null;
  };
  def.lifecycle.onUnmounted(retire);
  def.lifecycle.onBeforeDispose(retire);
  def.props.watch(['checked', 'indeterminate'], syncOwner);
  def.props.watch(['disabled', 'readOnly'], syncPolicy);
  if (binding) {
    for (const state of [binding.state.fieldDisabled, binding.state.fieldReadOnly])
      state.watch(() => {
        if (currentRun) syncPolicy(currentRun);
      });
    focused.watch((_run, event) => {
      if (event.type === 'next') reportField(event.next ? 'sync' : 'blur');
    });
  }

  const activate = (
    run: RunHandle<CheckboxRootProps>,
    ownerCurrent: () => boolean = () => true,
    key?: string
  ) => {
    if (!mounted || currentRun !== run) return;
    const view = viewEpoch,
      operation = ++operationEpoch;
    const live = () => isCurrent(run, view, operation) && ownerCurrent();
    pressed.set(false, 'reason: checkbox press complete');
    if (!live() || disabled.get() || readOnly.get() || key === 'Enter') return;
    const before = checked.get(),
      owner = checkedOwnerEpoch,
      mixed = indeterminate.get();
    if (mixed) {
      if (!controlledIndeterminate)
        indeterminate.set(false, 'reason: checkbox activation clears mixed');
      if (!live()) return;
      run.expose.emit('indeterminateChange', { indeterminate: false });
      if (!live() || disabled.get() || readOnly.get()) return;
      // A newer checked owner decision retires the old activation's checked stage.
      // Confirming only mixed=false still allows the original boolean request.
      if (checkedOwnerEpoch !== owner) {
        if (!publish(run)) return;
        reportField();
        if (live()) reports.schedule(before);
        return;
      }
    }
    const next = !before;
    if (!controlledChecked) checked.set(next, 'reason: checkbox accepted checked');
    if (!live()) return;
    run.expose.emit('checkedChange', {
      checked: next,
      indeterminate: mixed ? false : indeterminate.get(),
    });
    if (!live() || !publish(run)) return;
    reportField();
    if (live()) reports.schedule(before);
  };
  def.event.on('press.commit', (run, event) => activate(run, undefined, event?.key));
  asControlLabel().target<CheckboxRootProps>(
    (run, request) => {
      if (!mounted || currentRun !== run || disabled.get() || !request.isCurrent()) return;
      const view = viewEpoch,
        operation = operationEpoch;
      const live = () => isCurrent(run, view, operation) && request.isCurrent();
      focusable.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
      if (!live() || readOnly.get()) return;
      // activate starts a new operation; the label lease remains independently checked.
      activate(run, () => request.isCurrent());
    },
    options.fieldBinding ? FIELD_LABEL_PAIR : undefined
  );
  def.expose.method('resetValue', () => {
    const run = currentRun;
    if (!run || !mounted) return false;
    const view = viewEpoch,
      operation = ++operationEpoch;
    const live = () => isCurrent(run, view, operation);
    reports.cancel();
    pressed.set(false, 'reason: checkbox reset retires press');
    if (!live()) return true;
    if (!controlledChecked) checked.set(initialChecked, 'reason: checkbox reset canonical checked');
    if (!live()) return true;
    if (!controlledIndeterminate)
      indeterminate.set(initialIndeterminate, 'reason: checkbox reset canonical mixed');
    if (!live() || !publish(run)) return true;
    reportField();
    if (!live()) return true;
    if (controlledIndeterminate)
      run.expose.emit('indeterminateChange', { indeterminate: initialIndeterminate });
    if (!live()) return true;
    if (controlledChecked)
      run.expose.emit('checkedChange', {
        checked: initialChecked,
        indeterminate: initialIndeterminate,
      });
    return true;
  });
  def.event.onGlobal('key.down', (_run, event) => {
    if (!disabled.get() && focused.get() && event?.key === ' ')
      event.control.requestDefaultActionPrevention({
        reason: 'checkbox.space-activation',
        source: 'base-checkbox',
      });
  });
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'reason: checkbox pointer hover');
  });
  const leave = () => {
    hovered.set(false, 'reason: checkbox pointer left');
    if (currentRun) pressed.set(false, 'reason: checkbox pointer retired');
  };
  def.event.on('pointer.leave', leave);
  def.event.on('pointer.cancel', leave);
  def.event.on('pointer.down', () => {
    if (!disabled.get() && !readOnly.get()) pressed.set(true, 'reason: checkbox pointer press');
  });
  def.event.on('pointer.up', () => pressed.set(false, 'reason: checkbox pointer release'));
}

export const asCheckboxRoot = defineAsHook<
  CheckboxRootProps,
  CheckboxRootExposes,
  CheckboxRootAsHookContract
>({ name: 'as-checkbox-root', setup: setupCheckboxRoot });
export default definePrototype({ name: 'base-checkbox-root', setup: setupCheckboxRoot });
