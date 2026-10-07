import { defineAsHook, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import {
  FIELD_CONTEXT,
  FIELD_FAMILY,
  copyFieldValue,
  fieldRootMethod,
  normalizeFieldControlReport,
  rejectFieldDuplicates,
  type FieldControlSnapshot,
} from './shared';
import type {
  FieldControlBindingProps,
  FieldControlBindingHandles,
  FieldControlBindingStates,
  FieldControlReport,
} from './types';
let controlSequence = 0;
function setup(def: DefHandle<FieldControlBindingProps>) {
  def.anatomy.claim(FIELD_FAMILY, { role: 'control' });
  def.expose.value('__fieldLease', ++controlSequence);
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    required: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, readOnly: false, required: false });
  const fieldDisabled = def.state.bool('fieldDisabled', false),
    fieldReadOnly = def.state.bool('fieldReadOnly', false),
    fieldRequired = def.state.bool('fieldRequired', false),
    invalid = def.state.bool('invalid', false),
    pending = def.state.bool('pending', false);
  for (const [key, state] of Object.entries({
    fieldDisabled,
    fieldReadOnly,
    fieldRequired,
    invalid,
    pending,
  }))
    def.expose.state(key, state);
  const errorKey = def.state.string('fieldErrorKey', '');
  const a11y = asAccessible();
  a11y.part(FIELD_FAMILY, { key: 'control' });
  a11y.state('disabled', fieldDisabled);
  a11y.state('readOnly', fieldReadOnly);
  a11y.state('required', fieldRequired);
  a11y.state('invalid', invalid);
  a11y.state('busy', pending);
  a11y.relation('labelledBy', {
    target: { kind: 'part', family: FIELD_FAMILY, role: 'label', key: 'label' },
  });
  a11y.relation('describedBy', {
    target: { kind: 'part', family: FIELD_FAMILY, role: 'description', key: 'description' },
  });
  a11y.relation('errorMessage', {
    target: { kind: 'part', family: FIELD_FAMILY, role: 'error', key: errorKey },
  });
  let run: RunHandle<FieldControlBindingProps> | null = null,
    active = false,
    hasInitial = false;
  let report: FieldControlReport = {
    value: null,
    initialValue: null,
    focused: false,
    composing: false,
  };
  const sync = (current: RunHandle<FieldControlBindingProps>) => {
    run = current;
    rejectFieldDuplicates(current, 'control');
    const ctx = current.context.read(FIELD_CONTEXT),
      p = current.props.get();
    fieldDisabled.set(ctx.disabled || !!p.disabled, 'reason: field control disabled');
    fieldReadOnly.set(ctx.readOnly || !!p.readOnly, 'reason: field control readonly');
    fieldRequired.set(ctx.required || !!p.required, 'reason: field control required');
    invalid.set(ctx.invalid, 'reason: field control invalid');
    pending.set(ctx.pending, 'reason: field control pending');
    errorKey.set(ctx.invalid ? 'error' : '', 'reason: field current error relation');
  };
  const notify = (reason: string) => {
    if (run) fieldRootMethod(run, '__fieldNotify')?.(reason);
  };
  def.expose.method(
    '__fieldSnapshot',
    (): FieldControlSnapshot => ({
      value: copyFieldValue(report.value),
      initialValue: copyFieldValue(report.initialValue ?? null),
      focused: !!report.focused,
      composing: !!report.composing,
      disabled: !!run?.props.get().disabled,
      readOnly: !!run?.props.get().readOnly,
      required: !!run?.props.get().required,
      active,
    })
  );
  def.expose.method('reportField', (next: FieldControlReport): boolean => {
    if (!run) return false;
    const previousReport = report;
    const normalized = normalizeFieldControlReport(next);
    // An invalid/throwing payload leaves both current value and initial baseline
    // untouched. A reentrant newer report must not be overwritten by this one.
    if (!normalized || !run || report !== previousReport) return false;
    const reason = normalized.reason ?? 'sync';
    if (
      (fieldDisabled.get() || fieldReadOnly.get()) &&
      (reason === 'input' || reason === 'change' || reason === 'compositionend')
    )
      return false;
    report = {
      value: copyFieldValue(normalized.value),
      initialValue: hasInitial
        ? report.initialValue
        : copyFieldValue(
            normalized.initialValue === undefined ? normalized.value : normalized.initialValue
          ),
      focused: normalized.focused ?? report.focused,
      composing: normalized.composing ?? report.composing,
    };
    hasInitial = true;
    notify(reason);
    return true;
  });
  def.context.subscribe(FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((current) => {
    active = true;
    sync(current);
    notify('sync');
  });
  def.lifecycle.onUpdated((current) => {
    sync(current);
    notify('sync');
  });
  def.props.watchAll((current) => {
    sync(current);
    notify('sync');
  });
  def.lifecycle.onUnmounted(() => {
    active = false;
    report.focused = false;
    notify('sync');
  });
  def.lifecycle.onBeforeDispose(() => {
    active = false;
    notify('sync');
    run = null;
  });
}
/** Generic atom: author explicitly bridges the control's canonical value and effective policy. */
export const asFieldControl = defineAsHook<
  FieldControlBindingProps,
  Record<string, unknown>,
  { state: FieldControlBindingStates },
  FieldControlBindingHandles
>({
  name: 'as-field-control',
  setup,
  projectHandle(result) {
    return {
      state: result.stateHandles!,
      report: result.getMethod!('reportField') as FieldControlBindingHandles['report'],
    };
  },
});
