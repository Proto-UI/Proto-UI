import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { FIELD_CONTEXT, FIELD_FAMILY, rejectFieldDuplicates } from './shared';
import type { FieldErrorProps, FieldErrorExposes, FieldErrorAsHookContract } from './types';
const messages = {
  valueMissing: 'This field is required.',
  tooShort: 'The value is too short.',
  tooLong: 'The value is too long.',
  customError: 'Please correct this value.',
};
function setup(def: DefHandle<FieldErrorProps, FieldErrorExposes>) {
  def.anatomy.claim(FIELD_FAMILY, { role: 'error' });
  def.props.define({
    message: { type: 'string', empty: 'fallback' },
    keepMounted: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ message: '', keepMounted: false });
  const invalid = def.state.bool('invalid', false),
    hidden = def.state.bool('hidden', true),
    message = def.state.string('message', '');
  def.expose.state('invalid', invalid);
  def.expose.state('hidden', hidden);
  def.expose.state('message', message);
  const a11y = asAccessible();
  a11y.part(FIELD_FAMILY, { key: 'error' });
  a11y.state('hidden', hidden);
  a11y.tree({ hidden });
  // Error is a description, not an implicit live region or an alert on mount.
  const sync = (run: RunHandle<FieldErrorProps>) => {
    rejectFieldDuplicates(run, 'error');
    const ctx = run.context.read(FIELD_CONTEXT),
      p = run.props.get();
    invalid.set(ctx.invalid, 'reason: field error invalid');
    hidden.set(!ctx.invalid, 'reason: field error hidden');
    message.set(
      p.message || ctx.errors.join(' ') || ctx.flags.map((flag) => messages[flag]).join(' '),
      'reason: field error message'
    );
    run.lifecycle.setPresent(!!p.keepMounted || ctx.invalid);
    run.update();
  };
  def.context.subscribe(FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.props.watchAll(sync);
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
  return () => message.get();
}
export const asFieldError = defineAsHook<
  FieldErrorProps,
  FieldErrorExposes,
  FieldErrorAsHookContract
>({ name: 'as-field-error', setup });
export default definePrototype({ name: 'base-field-error', setup });
