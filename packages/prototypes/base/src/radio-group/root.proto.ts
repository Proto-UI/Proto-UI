import {
  defineAsHook,
  definePrototype,
  delay,
  type DelayTask,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asAccessible, asCollection, asFocusRoving, asControlLabel } from '@proto.ui/hooks';
import { asOptionalFieldControl } from '../field/control-binding.proto';
import { createChoiceFieldReport } from '../field/choice-report';
import { FIELD_CONTEXT, FIELD_LABEL_PAIR } from '../field/shared';
import {
  getRadioGroupItems,
  RADIO_GROUP_CONTEXT,
  RADIO_GROUP_FAMILY,
  registerRadioGroupCoordinator,
  type RadioGroupContextValue,
  type RadioGroupItemSnapshot,
} from './shared';
import type {
  RadioGroupRootAsHookContract,
  RadioGroupRootExposes,
  RadioGroupRootProps,
} from './types';

function selectedItem(items: readonly RadioGroupItemSnapshot[], value: string) {
  return value ? (items.find((item) => item.value === value) ?? null) : null;
}
function resolveCurrent(items: readonly RadioGroupItemSnapshot[], value: string, current: string) {
  return (
    items.find((item) => item.instanceId === current && !item.disabled)?.instanceId ??
    items.find((item) => item.value === value && !item.disabled)?.instanceId ??
    items.find((item) => !item.disabled)?.instanceId ??
    ''
  );
}
function sameContext(a: RadioGroupContextValue, b: RadioGroupContextValue) {
  return (
    a.value === b.value &&
    a.controlled === b.controlled &&
    a.disabled === b.disabled &&
    a.readOnly === b.readOnly &&
    a.selectedItemId === b.selectedItemId &&
    a.currentItemId === b.currentItemId
  );
}
export type RadioGroupRootSetupOptions = Readonly<{ fieldBinding?: boolean }>;
/** The same Root owns selection and roving; explicit Field composition only reports it. */
export function setupRadioGroupRoot(
  def: DefHandle<RadioGroupRootProps, RadioGroupRootExposes>,
  options: RadioGroupRootSetupOptions = {}
): void {
  const binding = options.fieldBinding ? asOptionalFieldControl() : null;
  const accessible = asAccessible();
  def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'root' });
  const collection = asCollection();
  collection.configure({ family: RADIO_GROUP_FAMILY, itemRole: 'item' });
  const focusRoving = asFocusRoving<RadioGroupRootProps>();
  focusRoving.configure({
    navigation: 'arrow',
    orientation: 'both',
    loop: true,
    entry: 'selected',
  });
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ defaultValue: '', disabled: false, readOnly: false, a11yLabel: '' });
  const value = def.state.string('value', ''),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false);
  const focused = def.state.bool('focused', false),
    a11yLabel = def.state.string('a11yLabel', '');
  def.expose.state('value', value);
  def.expose.state('disabled', disabled);
  def.expose.state('readOnly', readOnly);
  def.expose.state('focused', focused);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.method('focusFirst', () => focusRoving.focusFirst());
  def.expose.method('focusLast', () => focusRoving.focusLast());
  def.expose.method('focusNext', () => focusRoving.focusNext());
  def.expose.method('focusPrev', () => focusRoving.focusPrev());
  def.expose.method('focusSelected', () => focusRoving.focusSelected());
  def.expose.method('focusSelf', () => {
    if (!disabled.get()) focusRoving.focusSelected();
  });
  accessible.role('radiogroup');
  accessible.name(a11yLabel);
  accessible.state('disabled', disabled);
  accessible.state('readOnly', readOnly);
  const initialContext: RadioGroupContextValue = {
    value: '',
    controlled: false,
    disabled: false,
    readOnly: false,
    selectedItemId: '',
    currentItemId: '',
  };
  def.context.provide(RADIO_GROUP_CONTEXT, initialContext);
  let currentRun: RunHandle<RadioGroupRootProps> | null = null;
  let contextSnapshot = initialContext,
    initialValue = '',
    currentPreferenceId = '';
  let requestedCurrentItemId: string | undefined;
  let mounted = false,
    viewEpoch = 0,
    operationEpoch = 0;
  let unregisterCoordinator: (() => void) | null = null;
  let focusTask: DelayTask | null = null;
  let focusEpoch = 0;
  const retireFocus = () => {
    focusEpoch++;
    focusTask?.cancel();
    focusTask = null;
  };
  const live = (run: RunHandle<RadioGroupRootProps>, view: number, operation: number) =>
    currentRun === run && viewEpoch === view && operationEpoch === operation;
  const reportField = (reason: 'sync' | 'change' | 'blur' = 'sync') => {
    if (binding && currentRun)
      binding.report({ value: value.get(), focused: focused.get(), composing: false, reason });
  };
  const reports = createChoiceFieldReport(
    () => !!binding && !!currentRun && mounted && !!currentRun.context.tryRead(FIELD_CONTEXT),
    () => value.get(),
    reportField
  );
  const publish = (run: RunHandle<RadioGroupRootProps>, preferred?: string) => {
    if (currentRun !== run) return false;
    const view = viewEpoch,
      operation = operationEpoch;
    const items = getRadioGroupItems(run);
    if (!live(run, view, operation)) return false;
    if (preferred !== undefined) currentPreferenceId = preferred;
    if (!items.some((item) => item.instanceId === currentPreferenceId && !item.disabled))
      currentPreferenceId = '';
    const next: RadioGroupContextValue = {
      value: value.get(),
      controlled: run.props.isProvided('value'),
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      selectedItemId: selectedItem(items, value.get())?.instanceId ?? '',
      currentItemId: resolveCurrent(items, value.get(), currentPreferenceId),
    };
    if (!sameContext(contextSnapshot, next)) {
      contextSnapshot = next;
      run.context.update(RADIO_GROUP_CONTEXT, next);
    }
    return live(run, view, operation);
  };
  const sampleFocus = (forcedReason?: 'sync') => {
    if (!mounted || !currentRun) return;
    if (!binding) {
      const current = currentRun;
      const next = current.anatomy
        .partsOf(RADIO_GROUP_FAMILY, 'item')
        .some(
          (part) => (part.getExpose('focused') as { get?(): boolean } | null)?.get?.() === true
        );
      if (currentRun === current) focused.set(next, 'reason: radio current owned focus');
      return;
    }
    retireFocus();
    const run = currentRun,
      view = viewEpoch,
      focus = focusEpoch;
    focusTask = delay(0, () => {
      if (currentRun !== run || viewEpoch !== view || focusEpoch !== focus) return;
      focusTask = null;
      const next = run.anatomy
        .partsOf(RADIO_GROUP_FAMILY, 'item')
        .some(
          (part) => (part.getExpose('focused') as { get?(): boolean } | null)?.get?.() === true
        );
      const reason = forcedReason ?? (focused.get() && !next ? 'blur' : 'sync');
      const operation = operationEpoch;
      focused.set(next, 'reason: radio group current owned focus');
      if (live(run, view, operation)) reportField(reason);
    });
  };
  if (binding)
    asControlLabel().target((_run, request) => {
      if (request.isCurrent() && currentRun && !disabled.get()) focusRoving.focusSelected();
    }, FIELD_LABEL_PAIR);

  const requestValue = (nextValue: string) => {
    const run = currentRun;
    if (!run || !mounted) return false;
    const preferred = requestedCurrentItemId;
    requestedCurrentItemId = undefined;
    // Current-item focus remains independent of value policy, including readonly.
    if (!publish(run, preferred)) return false;
    sampleFocus();
    if (
      disabled.get() ||
      readOnly.get() ||
      typeof nextValue !== 'string' ||
      !nextValue ||
      nextValue === value.get()
    )
      return false;
    const matches = getRadioGroupItems(run).filter((item) => item.value === nextValue);
    if (matches.length !== 1 || matches[0].disabled) return false;
    const view = viewEpoch,
      operation = ++operationEpoch,
      before = value.get();
    if (!run.props.isProvided('value'))
      value.set(nextValue, 'reason: radio accepted canonical value');
    if (!live(run, view, operation) || !publish(run, matches[0].instanceId)) return false;
    run.expose.emit('valueChange', { value: nextValue });
    if (!live(run, view, operation)) return false;
    reportField();
    if (!live(run, view, operation)) return false;
    reports.schedule(before);
    return true;
  };
  def.expose.method('requestValue', requestValue);
  const registerCoordinator = () => {
    unregisterCoordinator?.();
    unregisterCoordinator = registerRadioGroupCoordinator(value, {
      setCurrent: (id) => {
        requestedCurrentItemId = id;
      },
    });
  };
  const syncPolicy = (run: RunHandle<RadioGroupRootProps>) => {
    if (currentRun !== run) return;
    const p = run.props.get();
    const nextDisabled = binding ? binding.state.fieldDisabled.get() : !!p.disabled;
    const nextReadOnly = binding ? binding.state.fieldReadOnly.get() : !!p.readOnly;
    const policyChanged = nextDisabled !== disabled.get() || nextReadOnly !== readOnly.get();
    if (policyChanged) {
      operationEpoch++;
      reports.cancel();
      retireFocus();
    }
    const view = viewEpoch,
      operation = operationEpoch;
    disabled.set(nextDisabled, 'reason: radio effective disabled');
    if (!live(run, view, operation)) return;
    readOnly.set(nextReadOnly, 'reason: radio effective readonly');
    if (!live(run, view, operation)) return;
    a11yLabel.set(p.a11yLabel ?? '', 'reason: radio group accessible label');
    if (live(run, view, operation) && publish(run)) {
      reportField();
      if (policyChanged && live(run, view, operation)) sampleFocus('sync');
    }
  };
  const syncOwner = (run: RunHandle<RadioGroupRootProps>) => {
    if (currentRun !== run) return;
    const view = viewEpoch,
      operation = operationEpoch;
    if (run.props.isProvided('value'))
      value.set(run.props.get().value ?? '', 'reason: radio controlled canonical value');
    if (live(run, view, operation) && publish(run)) reportField();
  };
  def.lifecycle.onCreated((run) => {
    currentRun = run;
    initialValue = run.props.isProvided('value')
      ? (run.props.get().value ?? '')
      : (run.props.get().defaultValue ?? '');
    value.set(initialValue, 'reason: radio initial canonical value');
    registerCoordinator();
    syncPolicy(run);
  });
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    mounted = true;
    syncOwner(run);
    if (currentRun !== run || !mounted) return;
    registerCoordinator();
    syncPolicy(run);
    sampleFocus();
  });
  def.lifecycle.onUpdated((run) => {
    if (currentRun === run) publish(run);
  });
  const retire = () => {
    reports.cancel();
    retireFocus();
    operationEpoch++;
    viewEpoch++;
    mounted = false;
    currentRun = null;
    requestedCurrentItemId = undefined;
    unregisterCoordinator?.();
    unregisterCoordinator = null;
  };
  def.lifecycle.onUnmounted(() => {
    retire();
    focused.set(false, 'reason: radio group view focus retired');
  });
  def.lifecycle.onBeforeDispose(retire);
  def.anatomy.subscribeParts(RADIO_GROUP_FAMILY, 'item', (run) => {
    if (currentRun === run) {
      publish(run);
      sampleFocus();
    }
  });
  def.props.watch(['value'], syncOwner);
  def.props.watch(['disabled', 'readOnly', 'a11yLabel'], syncPolicy);
  if (binding)
    for (const state of [binding.state.fieldDisabled, binding.state.fieldReadOnly])
      state.watch(() => {
        if (currentRun) syncPolicy(currentRun);
      });
  def.expose.method('resetValue', () => {
    const run = currentRun;
    if (!run || !mounted) return false;
    const view = viewEpoch,
      operation = ++operationEpoch;
    reports.cancel();
    retireFocus();
    const controlled = run.props.isProvided('value');
    if (!controlled) value.set(initialValue, 'reason: radio reset canonical value');
    if (!live(run, view, operation) || !publish(run)) return true;
    reportField();
    if (live(run, view, operation) && controlled)
      run.expose.emit('valueChange', { value: initialValue });
    if (live(run, view, operation)) sampleFocus('sync');
    return true;
  });
}
export const asRadioGroupRoot = defineAsHook<
  RadioGroupRootProps,
  RadioGroupRootExposes,
  RadioGroupRootAsHookContract
>({ name: 'as-radio-group-root', setup: setupRadioGroupRoot });
export default definePrototype({ name: 'base-radio-group-root', setup: setupRadioGroupRoot });
