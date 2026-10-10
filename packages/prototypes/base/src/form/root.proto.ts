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
    sequence = 0,
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
  const values = (): FormValues => {
    const result: FormValues = Object.create(null);
    for (const { snapshot: s } of entries()) {
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
  const publish = () => {
    if (run)
      run.context.update(FORM_CONTEXT, {
        disabled: disabled.get(),
        pending: pending.get(),
        submitted: submitted.get(),
      });
  };
  const cancel = () => {
    waiting = null;
    pending.set(false, 'reason: form submission canceled');
    publish();
  };
  const finish = () => {
    if (!run || !waiting || validating) return;
    const snapshot = entries();
    if (JSON.stringify(values()) !== waiting.key) {
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
    cancel();
    if (invalid.length) {
      run.expose.emit('invalid', { names: invalid.map((x) => x.snapshot.name) });
      const focus = invalid[0].part.getExpose('focusControl');
      if (typeof focus === 'function') focus();
      return;
    }
    submitted.set(true, 'reason: form validated submit');
    publish();
    run.expose.emit('submit', { values: values(), submissionId: id });
  };
  def.expose.method('__fieldChanged', finish);
  def.expose.method('getValues', values);
  def.expose.method('cancelSubmit', cancel);
  def.expose.method('requestSubmit', () => {
    if (!run || disabled.get()) return false;
    cancel();
    submitted.set(false, 'reason: form new submission');
    waiting = { id: ++sequence, key: JSON.stringify(values()) };
    pending.set(true, 'reason: form validating');
    publish();
    validating = true;
    try {
      for (const part of parts()) {
        const snapshot = read(part);
        if (snapshot?.disabled) continue;
        const validate = part.getExpose('validate');
        if (typeof validate === 'function') validate('manual');
      }
    } finally {
      validating = false;
    }
    finish();
    return true;
  });
  def.expose.method('resetValidation', () => {
    cancel();
    for (const part of parts()) {
      const reset = part.getExpose('resetValidation');
      if (typeof reset === 'function') reset();
    }
    submitted.set(false, 'reason: form reset validation');
    publish();
    run?.expose.emit('reset', {});
  });
  const sync = (current: RunHandle<FormRootProps>) => {
    run = current;
    disabled.set(!!run.props.get().disabled, 'reason: form disabled');
    label.set(run.props.get().ariaLabel ?? '', 'reason: form name');
    if (disabled.get()) cancel();
    publish();
  };
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(() => {
    cancel();
    run = null;
  });
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
