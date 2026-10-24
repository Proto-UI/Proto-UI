import { afterEach, expect, it } from 'vitest';
import { createControlLabelRef, definePrototype } from '@proto.ui/core';
import {
  AdaptToWebComponent,
  setElementProps,
  setElementAssociations,
} from '@proto.ui/adapter-web-component';
import {
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldTextarea,
  asFieldTextarea,
} from '../src/field';
import textarea from '../src/textarea';
import labelRoot from '../src/label';
let handle: ReturnType<typeof asFieldTextarea>;
const consumer = definePrototype({
  name: 'test-field-textarea-consumer',
  modules: asFieldTextarea.modules,
  setup() {
    handle = asFieldTextarea();
    return () => null;
  },
});
for (const p of [
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldTextarea,
  consumer,
  textarea,
  labelRoot,
])
  AdaptToWebComponent(p);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
function mount(props: Record<string, unknown> = {}, controlProps: Record<string, unknown> = {}) {
  const field = document.createElement(fieldRoot.name) as any;
  const control = document.createElement(consumer.name) as any;
  const label = document.createElement(fieldLabel.name);
  label.textContent = 'Message';
  const description = document.createElement(fieldDescription.name);
  description.textContent = 'Long form';
  const error = document.createElement(fieldError.name);
  setElementProps(field, props);
  setElementProps(control, controlProps);
  field.append(label, description, control, error);
  document.body.append(field);
  return {
    field,
    control,
    label,
    description,
    error,
    editor: () => control.querySelector('textarea') as HTMLTextAreaElement,
  };
}
it('uses canonical Field invalid while retaining one multiline editor and borrowed binding', async () => {
  const m = mount({ invalid: false }, { defaultValue: 'keep this', rows: 4 });
  await flush();
  const editor = m.editor(),
    binding = handle.getAsHookHandle!('as-optional-field-control');
  expect(binding).toBeDefined();
  expect(binding!.state.invalid.get()).toBe(false);
  editor.focus();
  editor.setSelectionRange(2, 6);
  const value = handle.stateHandles!.value;
  setElementProps(m.field, { invalid: true, errors: ['Invalid message'] });
  await flush();
  expect(m.editor()).toBe(editor);
  expect(editor.value).toBe('keep this');
  expect(Number(editor.rows)).toBe(4);
  expect(editor.selectionStart).toBe(2);
  expect(editor.selectionEnd).toBe(6);
  expect(handle.stateHandles!.value).toBe(value);
  expect(handle.getAsHookHandle!('as-optional-field-control')).toBe(binding);
  expect(binding!.state.invalid.get()).toBe(true);
  expect(editor.getAttribute('aria-invalid')).toBe('true');
  expect(editor.getAttribute('aria-labelledby')).toBe(m.label.id);
  expect(editor.getAttribute('aria-describedby')).toBe(m.description.id);
  expect(editor.getAttribute('aria-errormessage')).toBe(m.error.id);
  setElementProps(m.field, { invalid: false });
  await flush();
  expect(editor.getAttribute('aria-invalid')).toBe('false');
  expect(editor.hasAttribute('aria-errormessage')).toBe(false);
});
it('combines local and Field policies with withdrawal preserving local restrictions', async () => {
  const m = mount(
    { disabled: true, readOnly: true, required: true },
    { defaultValue: 'abc', readOnly: true }
  );
  await flush();
  const e = m.editor();
  expect(e.disabled).toBe(true);
  expect(e.readOnly).toBe(true);
  expect(e.required).toBe(true);
  setElementProps(m.field, { disabled: false, readOnly: false, required: false });
  await flush();
  expect(e.disabled).toBe(false);
  expect(e.readOnly).toBe(true);
  expect(e.required).toBe(false);
  setElementProps(m.control, { readOnly: false, disabled: true });
  await flush();
  expect(e.disabled).toBe(true);
  expect(e.readOnly).toBe(false);
  expect(e.value).toBe('abc');
});
it('reports canonical editing value to the Field validator rather than HTML validity', async () => {
  const m = mount({ required: true, validationMode: 'manual' });
  await flush();
  m.field.getExposes().validate();
  await flush();
  expect(m.control.getExposes().invalid.get()).toBe(true);
  const e = m.editor();
  e.value = 'valid';
  e.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  await flush();
  m.field.getExposes().validate();
  await flush();
  expect(m.control.getExposes().invalid.get()).toBe(false);
  expect(m.field.getExposes().getValidity().filled).toBe(true);
});
it('the explicit Field composition can stand alone with local policy and no synthetic invalid', async () => {
  const c = document.createElement(fieldTextarea.name) as any;
  setElementProps(c, { defaultValue: 'alone', required: true });
  document.body.append(c);
  await flush();
  const e = c.querySelector('textarea');
  expect(e.value).toBe('alone');
  expect(e.required).toBe(true);
  expect(c.getExposes().invalid.get()).toBe(false);
});
it('retains IME and canonical controlled value through Field status changes', async () => {
  const m = mount({ invalid: false }, { value: 'accepted', rows: 3 });
  await flush();
  const e = m.editor();
  e.focus();
  e.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
  await flush();
  expect(m.control.getExposes().composing.get()).toBe(true);
  setElementProps(m.field, { invalid: true });
  await flush();
  expect(m.editor()).toBe(e);
  expect(m.control.getExposes().composing.get()).toBe(true);
  e.value = 'candidate';
  e.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'candidate', isComposing: true }));
  e.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'candidate' }));
  await flush();
  expect(m.control.getExposes().composing.get()).toBe(false);
  expect(e.value).toBe('accepted');
  expect(m.control.getExposes().__fieldSnapshot().value).toBe('accepted');
  setElementProps(m.control, { value: 'updated', rows: 5 });
  await flush();
  expect(m.editor()).toBe(e);
  expect(e.value).toBe('updated');
  expect(Number(e.rows)).toBe(5);
});
it('updates anatomy relationships and focuses the same editor from Field label activation', async () => {
  const m = mount({ invalid: true });
  await flush();
  const e = m.editor();
  for (const type of ['pointerdown', 'pointerup'])
    m.label.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  m.label.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
  await flush();
  expect(document.activeElement).toBe(e);
  const replacement = document.createElement(fieldDescription.name);
  replacement.textContent = 'Replacement';
  m.description.remove();
  await flush();
  m.field.append(replacement);
  await flush();
  expect(e.getAttribute('aria-describedby')).toBe(replacement.id);
  expect(m.editor()).toBe(e);
  m.error.remove();
  await flush();
  expect(e.hasAttribute('aria-errormessage')).toBe(false);
});
it('does not report stale editing after an outward handler disposes the control', async () => {
  const m = mount({ validationMode: 'onChange' }, { defaultValue: 'before' });
  await flush();
  const e = m.editor();
  m.control.addEventListener('valueChange', () => m.control.remove(), { once: true });
  e.value = 'after';
  e.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'after' }));
  await flush();
  expect(m.control.isConnected).toBe(false);
  expect(m.field.getExposes().getValidity().filled).toBe(false);
  e.value = 'stale';
  e.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'stale' }));
  await flush();
  expect(m.field.getExposes().getValidity().filled).toBe(false);
});
it.each(['labelledBy', 'describedBy'])('rejects conflicting external %s in Field mode', (key) => {
  const c = document.createElement(fieldTextarea.name);
  setElementProps(c, { [key]: 'external' });
  expect(() => document.body.append(c)).toThrow('Field owns label and description relationships');
});
it('ordinary Textarea keeps explicit independent labels and ignores a surrounding Field policy', async () => {
  const f = document.createElement(fieldRoot.name),
    c = document.createElement(textarea.name),
    l = document.createElement(labelRoot.name);
  const ref = createControlLabelRef();
  setElementAssociations(c, { controlLabel: ref });
  setElementAssociations(l, { controlLabel: ref });
  setElementProps(l, { activation: true });
  setElementProps(f, { disabled: true, invalid: true });
  setElementProps(c, { defaultValue: 'ordinary', describedBy: 'external-description' });
  f.append(c, l);
  document.body.append(f);
  await flush();
  const e = c.querySelector('textarea')!;
  expect(e.disabled).toBe(false);
  expect(e.hasAttribute('aria-invalid')).toBe(false);
  expect(e.getAttribute('aria-labelledby')).toBe(l.id);
  expect(e.getAttribute('aria-describedby')).toBe('external-description');
  for (const type of ['pointerdown', 'pointerup'])
    l.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  l.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 }));
  await flush();
  expect(document.activeElement).toBe(e);
});
it('disabled Field label activation does not transfer focus or mutate the editor', async () => {
  const m = mount({ disabled: true }, { defaultValue: 'untouched' });
  await flush();
  const e = m.editor();
  for (const type of ['pointerdown', 'pointerup'])
    m.label.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  m.label.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
  await flush();
  expect(document.activeElement).not.toBe(e);
  expect(e.value).toBe('untouched');
});
