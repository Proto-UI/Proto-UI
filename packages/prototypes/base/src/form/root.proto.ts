import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type AnatomyPartView,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { FORM_CONTEXT, FORM_FAMILY, type FormFieldSnapshot } from './shared';
import type { FormRootProps, FormRootExposes, FormRootAsHookContract, FormValues } from './types';
function setup(def: DefHandle<FormRootProps, FormRootExposes>) {
  def.anatomy.claim(FORM_FAMILY, { role: 'root' });
  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, ariaLabel: '' });
  const disabled = def.state.bool('disabled', false),
    pending = def.state.bool('pending', false),
    submitted = def.state.bool('submitted', false),
    label = def.state.string('label', '');
  def.expose.state('disabled', disabled);
  def.expose.state('pending', pending);
  def.expose.state('submitted', submitted);
  for (const e of ['submit', 'invalid', 'reset'] as const) def.expose.event(e, { payload: 'json' });
  const a = asAccessible();
  a.role('form');
  a.name(label);
  a.state('busy', pending);
  a.state('disabled', disabled);
  def.context.provide(FORM_CONTEXT, { disabled: false, pending: false, submitted: false });
  let run: RunHandle<FormRootProps> | null = null,
    viewEpoch = 0,
    sequence = 0,
    cancellation = 0,
    waiting: { id: number; key: string } | null = null,
    validating = false;
  const parts = () => run?.anatomy.order.partsOf(FORM_FAMILY, 'field') ?? [];
  const read = (p: AnatomyPartView): FormFieldSnapshot | null => {
    const fn = p.getExpose('__formField');
    return typeof fn === 'function' ? fn() : null;
  };
  const entries = () =>
    parts()
      .map((part) => ({ part, snapshot: read(part) }))
      .filter(
        (x): x is { part: AnatomyPartView; snapshot: FormFieldSnapshot } =>
          !!x.snapshot && !x.snapshot.disabled
      );
  const valuesFrom = (snapshot: ReturnType<typeof entries>): FormValues => {
    const result: FormValues = Object.create(null);
    for (const { snapshot: s } of snapshot) {
      if (!s.name || !s.available) continue;
      if (Object.hasOwn(result, s.name)) throw new Error('FORM_DUPLICATE_NAME: ' + s.name);
      Object.defineProperty(result, s.name, {
        value: s.value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  };
  const values = (): FormValues => valuesFrom(entries());
  const publish = () => {
    if (run)
      run.context.update(FORM_CONTEXT, {
        disabled: disabled.get(),
        pending: pending.get(),
        submitted: submitted.get(),
      });
  };
  const cancel = () => {
    const current = run,
      epoch = viewEpoch;
    cancellation++;
    const generation = cancellation;
    waiting = null;
    pending.set(false, 'reason: form submission canceled');
    if (run !== current || viewEpoch !== epoch || cancellation !== generation) return;
    publish();
  };
  const finish = () => {
    if (!run || !waiting || validating) return;
    const snapshot = entries();
    const validatedValues = valuesFrom(snapshot);
    if (JSON.stringify(validatedValues) !== waiting.key) {
      cancel();
      return;
    }
    if (snapshot.some((x) => x.snapshot.validity.pending)) return;
    const invalid = snapshot.filter(
      (x) =>
        !x.snapshot.available ||
        x.snapshot.validity.status !== 'valid' ||
        x.snapshot.validity.invalid
    );
    const id = waiting.id;
    const current = run;
    const generation = cancellation;
    const ownsCompletion = () => run === current && cancellation === generation && sequence === id;
    waiting = null;
    pending.set(false, 'reason: form validation completed');
    if (!ownsCompletion()) return;
    publish();
    if (!ownsCompletion()) return;
    if (invalid.length) {
      run.expose.emit('invalid', { names: invalid.map((x) => x.snapshot.name) });
      if (!ownsCompletion()) return;
      const focus = invalid[0].part.getExpose('focusControl');
      if (typeof focus === 'function') focus();
      return;
    }
    submitted.set(true, 'reason: form validated submit');
    if (!ownsCompletion()) return;
    publish();
    if (!ownsCompletion()) return;
    current.expose.emit('submit', { values: validatedValues, submissionId: id });
  };
  def.expose.method('__fieldChanged', finish);
  def.expose.method('getValues', values);
  def.expose.method('cancelSubmit', cancel);
  const requestSubmit = () => {
    if (!run || disabled.get()) return false;
    const current = run,
      epoch = viewEpoch,
      generation = cancellation + 1;
    let id = sequence;
    const isCurrent = () =>
      run === current && viewEpoch === epoch && cancellation === generation && sequence === id;
    cancel();
    if (!isCurrent()) return true;
    submitted.set(false, 'reason: form new submission');
    if (!isCurrent()) return true;
    id = ++sequence;
    waiting = { id, key: JSON.stringify(values()) };
    pending.set(true, 'reason: form validating');
    if (!isCurrent()) return true;
    publish();
    if (!isCurrent()) return true;
    validating = true;
    try {
      for (const part of parts()) {
        const snapshot = read(part);
        if (snapshot?.disabled) continue;
        const validate = part.getExpose('validate');
        if (typeof validate === 'function') validate('manual');
        if (!isCurrent()) return true;
      }
    } finally {
      validating = false;
    }
    finish();
    return true;
  };
  def.expose.method('requestSubmit', requestSubmit);
  def.event.onGlobal('key.down', (_run, event) => {
    if (
      event.key !== 'Enter' ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      disabled.get()
    )
      return;
    if (!entries().some(({ snapshot }) => snapshot.available && snapshot.implicitSubmit)) return;
    event.control.requestDefaultActionPrevention({
      reason: 'form.implicit-submit',
      source: 'base-form-root',
    });
    requestSubmit();
  });
  def.expose.method('resetValidation', () => {
    const current = run,
      epoch = viewEpoch;
    const isCurrent = () => run === current && viewEpoch === epoch;
    cancel();
    if (!isCurrent()) return;
    for (const part of parts()) {
      const reset = part.getExpose('resetValidation');
      if (typeof reset === 'function') reset();
      if (!isCurrent()) return;
    }
    submitted.set(false, 'reason: form reset validation');
    if (!isCurrent()) return;
    publish();
  });
  def.expose.method('requestReset', () => {
    if (!run) return false;
    const current = run,
      epoch = viewEpoch;
    const isCurrent = () => run === current && viewEpoch === epoch;
    cancel();
    if (!isCurrent()) return false;
    validating = true;
    let complete = true;
    try {
      for (const part of parts()) {
        const reset = part.getExpose('__formReset');
        if (typeof reset !== 'function' || reset() !== true) complete = false;
        if (!isCurrent()) return false;
      }
    } finally {
      validating = false;
    }
    submitted.set(false, 'reason: form reset');
    if (!isCurrent()) return false;
    publish();
    if (!isCurrent()) return false;
    current.expose.emit('reset', {});
    return complete;
  });
  const sync = (current: RunHandle<FormRootProps>) => {
    run = current;
    disabled.set(!!run.props.get().disabled, 'reason: form disabled');
    label.set(run.props.get().ariaLabel ?? '', 'reason: form name');
    if (disabled.get()) cancel();
    publish();
  };
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    viewEpoch++;
    sync(run);
  });
  def.props.watchAll(sync);
  const retireView = () => {
    viewEpoch++;
    run = null;
    cancel();
  };
  def.lifecycle.onUnmounted(retireView);
  def.lifecycle.onBeforeDispose(retireView);
  def.anatomy.subscribeParts(FORM_FAMILY, 'field', () => {
    if (waiting) cancel();
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asFormRoot = defineAsHook<FormRootProps, FormRootExposes, FormRootAsHookContract>({
  name: 'as-form-root',
  setup,
});
export default definePrototype({ name: 'base-form-root', setup });
