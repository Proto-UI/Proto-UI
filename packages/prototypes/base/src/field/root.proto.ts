import { FORM_CONTEXT } from '../form/shared';
import { FIELDSET_CONTEXT } from '../fieldset/shared';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import {
  FIELD_CONTEXT,
  FIELD_FAMILY,
  EMPTY_VALIDITY,
  copyFieldValue,
  copyValidity,
  isFilled,
  normalizeFieldStringArray,
  normalizeFieldValidationResult,
  rejectFieldDuplicates,
  type FieldControlSnapshot,
  type FieldContext,
} from './shared';
import type {
  FieldRootProps,
  FieldRootExposes,
  FieldRootAsHookContract,
  FieldValidationReason,
  FieldValidationResult,
  FieldValidityFlag,
  FieldValiditySnapshot,
} from './types';
let rootSequence = 0;
const errorsValid = (v: unknown): v is string[] => normalizeFieldStringArray(v) !== undefined;
function setupFieldRoot(def: DefHandle<FieldRootProps, FieldRootExposes>) {
  def.anatomy.claim(FIELD_FAMILY, { role: 'root' });
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    required: { type: 'boolean', empty: 'fallback' },
    minLength: {
      type: 'number',
      empty: 'fallback',
      validator: (v) => Number.isInteger(v) && v >= -1,
    },
    maxLength: {
      type: 'number',
      empty: 'fallback',
      validator: (v) => Number.isInteger(v) && v >= -1,
    },
    invalid: { type: 'boolean', empty: 'fallback' },
    errors: { type: 'object', empty: 'fallback', validator: errorsValid },
    defaultInvalid: { type: 'boolean', empty: 'fallback' },
    defaultErrors: { type: 'object', empty: 'fallback', validator: errorsValid },
    validationMode: { type: 'enum', empty: 'fallback', options: ['onBlur', 'onChange', 'manual'] },
    externalValidation: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    disabled: false,
    readOnly: false,
    required: false,
    minLength: -1,
    maxLength: -1,
    defaultInvalid: false,
    defaultErrors: [],
    validationMode: 'onBlur',
    externalValidation: false,
  });
  const states = {
    invalid: def.state.bool('invalid', false),
    pending: def.state.bool('pending', false),
    dirty: def.state.bool('dirty', false),
    touched: def.state.bool('touched', false),
    filled: def.state.bool('filled', false),
    focused: def.state.bool('focused', false),
    disabled: def.state.bool('disabled', false),
    readOnly: def.state.bool('readOnly', false),
    required: def.state.bool('required', false),
  };
  for (const key of Object.keys(states) as (keyof typeof states)[])
    def.expose.state(key, states[key]);
  def.expose.event('validationRequest', { payload: 'json' });
  def.expose.event('validityChange', { payload: 'json' });
  const initial: FieldContext = {
    ...EMPTY_VALIDITY,
    disabled: false,
    readOnly: false,
    required: false,
    minLength: -1,
    maxLength: -1,
  };
  def.context.provide(FIELD_CONTEXT, initial);
  def.context.subscribe(FIELD_CONTEXT, () => {});
  const rootId = ++rootSequence;
  let run: RunHandle<FieldRootProps> | null = null;
  let mounted = false,
    initialized = false,
    localInvalid = false,
    touched = false,
    registeredOnce = false;
  let localErrors: string[] = [],
    flags: FieldValidityFlag[] = [],
    status: FieldValiditySnapshot['status'] = 'unvalidated';
  let source: unknown = null,
    valueKey: string | null = null,
    revision = 0,
    sequence = 0;
  let pending: { requestId: string; revision: number; source: unknown } | null = null;
  let previousDisabled = false,
    previousReadOnly = false,
    previousComposing = false,
    previousRequired: boolean | null = null;
  const invalidate = () => {
    revision++;
    pending = null;
  };
  const control = (): { source: unknown; snapshot: FieldControlSnapshot } | null => {
    if (!run) return null;
    const parts = run.anatomy.partsOf(FIELD_FAMILY, 'control');
    if (parts.length !== 1) return null;
    const read = parts[0].getExpose('__fieldSnapshot');
    if (typeof read !== 'function') return null;
    const snapshot = read() as FieldControlSnapshot;
    return snapshot?.active ? { source: parts[0].getExpose('__fieldLease'), snapshot } : null;
  };
  const publish = () => {
    if (!run || !initialized) return;
    const p = run.props.get(),
      found = control(),
      snapshot = found?.snapshot;
    const nextSource = found?.source ?? null;
    const nextKey = snapshot ? JSON.stringify(snapshot.value) : null;
    const replaced = source !== nextSource;
    if (replaced || valueKey !== nextKey) {
      invalidate();
      source = nextSource;
      valueKey = nextKey;
      if (registeredOnce) {
        localInvalid = false;
        localErrors = [];
        flags = [];
        status = 'unvalidated';
      }
      if (snapshot) registeredOnce = true;
      if (replaced) touched = false;
    }
    const required = !!p.required || !!snapshot?.required;
    if (previousRequired !== null && required !== previousRequired) {
      invalidate();
      localInvalid = false;
      localErrors = [];
      flags = [];
      status = 'unvalidated';
    }
    previousRequired = required;
    const disabled =
      !!p.disabled ||
      !!snapshot?.disabled ||
      !!run.context.tryRead(FIELDSET_CONTEXT)?.disabled ||
      !!run.context.tryRead(FORM_CONTEXT)?.disabled;
    const readOnly = !!p.readOnly || !!snapshot?.readOnly;
    if (previousDisabled !== disabled || previousReadOnly !== readOnly) invalidate();
    if (!previousComposing && snapshot?.composing) invalidate();
    previousComposing = !!snapshot?.composing;
    previousDisabled = disabled;
    previousReadOnly = readOnly;
    const controlled = run.props.isProvided('invalid');
    const invalid = controlled ? !!p.invalid : localInvalid;
    const errors = controlled ? [...(p.errors ?? [])] : [...localErrors];
    const next: FieldContext = {
      status: controlled ? (invalid ? 'invalid' : 'valid') : status,
      invalid,
      errors,
      flags: controlled ? (invalid ? ['customError'] : []) : [...flags],
      pending: pending !== null,
      touched,
      dirty: !!snapshot && JSON.stringify(snapshot.value) !== JSON.stringify(snapshot.initialValue),
      filled: !!snapshot && isFilled(snapshot.value),
      focused: !!snapshot?.focused,
      disabled,
      readOnly,
      required,
      minLength: p.minLength ?? -1,
      maxLength: p.maxLength ?? -1,
    };
    if (next.pending && next.status === 'valid') next.status = 'unvalidated';
    if (!snapshot) {
      next.pending = false;
      next.focused = false;
      next.status = 'unvalidated';
    }
    const previous = run.context.read(FIELD_CONTEXT);
    if (JSON.stringify(previous) !== JSON.stringify(next)) run.context.update(FIELD_CONTEXT, next);
    const canonical = run.context.read(FIELD_CONTEXT);
    for (const key of Object.keys(states) as (keyof typeof states)[])
      states[key].set(canonical[key], 'reason: field canonical ' + key);
  };
  const emitResult = () => {
    if (run)
      run.expose.emit('validityChange', {
        ...copyValidity(run.context.read(FIELD_CONTEXT)),
        invalid: localInvalid,
        errors: [...localErrors],
        flags: [...flags],
        status,
        pending: false,
      });
  };
  const validate = (reason: FieldValidationReason = 'manual'): string | null => {
    publish();
    if (!run || !mounted) return null;
    const found = control(),
      p = run.props.get();
    if (!found || states.disabled.get() || found.snapshot.composing) return null;
    if (reason !== 'blur' && reason !== 'change' && reason !== 'manual') return null;
    invalidate();
    const value = found.snapshot.value;
    flags = [];
    if (states.required.get() && !isFilled(value)) flags.push('valueMissing');
    if (typeof value === 'string' && value.length > 0) {
      if ((p.minLength ?? -1) >= 0 && value.length < p.minLength!) flags.push('tooShort');
      if ((p.maxLength ?? -1) >= 0 && value.length > p.maxLength!) flags.push('tooLong');
    }
    localInvalid = flags.length > 0;
    localErrors = [];
    status = localInvalid ? 'invalid' : 'valid';
    if (!localInvalid && p.externalValidation) {
      const requestId = 'field-' + rootId + '-' + revision + '-' + ++sequence;
      pending = { requestId, revision, source: found.source };
      // Pending is not a successful validation; retain an explicit unvalidated status.
      status = 'unvalidated';
      publish();
      run.expose.emit('validationRequest', { requestId, value: copyFieldValue(value), reason });
      return requestId;
    }
    publish();
    emitResult();
    return null;
  };
  def.expose.method('validate', validate);
  def.expose.method('getValidity', () =>
    copyValidity(run?.context.read(FIELD_CONTEXT) ?? EMPTY_VALIDITY)
  );
  def.expose.method('resolveValidation', (requestId: string, result: FieldValidationResult) => {
    publish();
    if (
      !run ||
      !mounted ||
      !pending ||
      states.disabled.get() ||
      pending.requestId !== requestId ||
      pending.revision !== revision ||
      pending.source !== control()?.source ||
      control()?.snapshot.composing
    )
      return false;
    const request = pending;
    const normalized = normalizeFieldValidationResult(result);
    if (!normalized) return false;
    // Payload reads can throw or reenter the owner. Do not spend a lease until
    // a complete safe snapshot exists, and let a newer owner action win.
    publish();
    if (
      !run ||
      !mounted ||
      pending !== request ||
      states.disabled.get() ||
      request.revision !== revision ||
      request.source !== control()?.source ||
      control()?.snapshot.composing
    )
      return false;
    pending = null;
    localInvalid = normalized.invalid;
    localErrors = normalized.invalid ? normalized.errors : [];
    flags = normalized.invalid ? ['customError'] : [];
    status = normalized.invalid ? 'invalid' : 'valid';
    publish();
    emitResult();
    return true;
  });
  def.expose.method('cancelValidation', () => {
    invalidate();
    publish();
  });
  def.expose.method('resetValidation', () => {
    invalidate();
    touched = false;
    localInvalid = false;
    localErrors = [];
    flags = [];
    status = 'unvalidated';
    publish();
  });
  def.expose.method('focusControl', (options) => {
    publish();
    if (!run || !mounted || states.disabled.get() || !control()) return false;
    const focus = run.anatomy.partsOf(FIELD_FAMILY, 'control')[0]?.getExpose('focusSelf');
    if (typeof focus !== 'function') return false;
    focus(options);
    return true;
  });
  def.expose.method('__fieldNotify', (reason: string) => {
    publish();
    if (!run || !control() || states.disabled.get()) return;
    if (reason === 'blur') {
      touched = true;
      publish();
    }
    const mode = run.props.get().validationMode;
    if (
      (reason === 'blur' && mode === 'onBlur') ||
      ((reason === 'input' || reason === 'change' || reason === 'compositionend') &&
        mode === 'onChange')
    )
      validate(reason === 'blur' ? 'blur' : 'change');
  });
  def.context.trySubscribe(FORM_CONTEXT, (current) => {
    run = current;
    publish();
  });
  def.context.trySubscribe(FIELDSET_CONTEXT, (current) => {
    run = current;
    publish();
  });
  def.lifecycle.onCreated((current) => {
    run = current;
    initialized = true;
    localInvalid = current.props.get().defaultInvalid ?? false;
    localErrors = [...(current.props.get().defaultErrors ?? [])];
    if (localInvalid) {
      flags = ['customError'];
      status = 'invalid';
    }
    publish();
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    mounted = true;
    publish();
  });
  def.lifecycle.onUpdated((current) => {
    run = current;
    publish();
  });
  def.lifecycle.onUnmounted(() => {
    mounted = false;
    invalidate();
    publish();
  });
  def.lifecycle.onBeforeDispose(() => {
    mounted = false;
    invalidate();
    run = null;
  });
  def.props.watchAll((current, _next, _previous, info) => {
    run = current;
    if (
      info.changedKeysAll.some(
        (key) => key === 'minLength' || key === 'maxLength' || key === 'externalValidation'
      )
    ) {
      localInvalid = false;
      localErrors = [];
      flags = [];
      status = 'unvalidated';
    }
    // Defaults initialize uncontrolled validity once; later defaults are not
    // a revision of the current validation policy or its pending request.
    if (info.changedKeysAll.some((key) => key !== 'defaultInvalid' && key !== 'defaultErrors'))
      invalidate();
    publish();
  });
  for (const role of ['control', 'label', 'description', 'error'])
    def.anatomy.subscribeParts(FIELD_FAMILY, role, (current) => {
      run = current;
      rejectFieldDuplicates(current, role);
      publish();
    });
}
// The Root preserves authored children and delegates physical rendering to its Adapter.
function setup(def: DefHandle<FieldRootProps, FieldRootExposes>) {
  setupFieldRoot(def);
  return (r: import('@proto.ui/core').RendererHandle<any>) => r.slot();
}
export const asFieldRoot = defineAsHook<FieldRootProps, FieldRootExposes, FieldRootAsHookContract>({
  name: 'as-field-root',
  setup,
});
export default definePrototype({ name: 'base-field-root', setup });
