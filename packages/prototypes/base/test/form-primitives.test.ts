import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldsetRoot, fieldsetLegend, fieldsetDescription } from '../src/fieldset';
import { formRoot, formField, formSubmit } from '../src/form';
import { checkboxGroupRoot, checkboxGroupItem, checkboxGroupAll } from '../src/checkbox-group';
import { fieldRoot, fieldLabel, fieldControl } from '../src/field';
for (const p of [
  fieldsetRoot,
  fieldsetLegend,
  fieldsetDescription,
  formRoot,
  formField,
  formSubmit,
  checkboxGroupRoot,
  checkboxGroupItem,
  checkboxGroupAll,
  fieldRoot,
  fieldLabel,
  fieldControl,
])
  AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const part = (name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement('base-' + name) as any;
  setElementProps(el, props);
  return el;
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const field = (props: Record<string, unknown> = {}, isForm = false) => {
  const root = part(isForm ? 'form-field' : 'field-root', props),
    control = part('field-control', { defaultValue: 'ok' });
  root.append(control);
  return { root, control };
};
it('Fieldset toggles inherited disabled without losing local policy and rejects stale validation', async () => {
  const group = part('fieldset-root'),
    legend = part('fieldset-legend');
  legend.textContent = 'Profile';
  const a = field({ externalValidation: true }),
    b = field({ disabled: true });
  group.append(legend, a.root, b.root);
  document.body.append(group);
  await flush();
  expect(group.getAttribute('aria-labelledby')).toBe(legend.id);
  const request = a.root.getExposes().validate();
  expect(a.root.getExposes().pending.get()).toBe(true);
  setElementProps(group, { disabled: true });
  await flush();
  expect(a.root.getExposes().disabled.get()).toBe(true);
  expect(a.root.getExposes().resolveValidation(request, { invalid: false })).toBe(false);
  const editor = a.control.shadowRoot?.querySelector('input') ?? a.control.querySelector('input');
  expect(editor.disabled).toBe(true);
  setElementProps(group, { disabled: false });
  await flush();
  expect(a.root.getExposes().disabled.get()).toBe(false);
  expect(b.root.getExposes().disabled.get()).toBe(true);
});
it('Checkbox Group owns arrays and aggregate toggles while preserving disabled selections', async () => {
  const root = part('checkbox-group-root', { defaultValue: ['a', 'c'] }),
    all = part('checkbox-group-all'),
    a = part('checkbox-group-item', { value: 'a' }),
    b = part('checkbox-group-item', { value: 'b' }),
    c = part('checkbox-group-item', { value: 'c', disabled: true });
  root.append(all, a, b, c);
  document.body.append(root);
  await flush();
  expect(all.getExposes().indeterminate.get()).toBe(true);
  expect(all.getAttribute('aria-checked')).toBe('mixed');
  expect(root.getExposes().requestAll()).toBe(true);
  await flush();
  expect(root.getExposes().getValue()).toEqual(['a', 'c', 'b']);
  expect(all.getExposes().checked.get()).toBe(true);
  root.getExposes().requestAll();
  await flush();
  expect(root.getExposes().getValue()).toEqual(['c']);
  expect(root.getExposes().requestToggle('c')).toBe(false);
  const copy = root.getExposes().getValue();
  copy.push('pollution');
  expect(root.getExposes().getValue()).toEqual(['c']);
  setElementProps(root, { value: ['a'], readOnly: true });
  await flush();
  expect(root.getExposes().requestToggle('b')).toBe(false);
  expect(b.getExposes().readOnly.get()).toBe(true);
});
it('Checkbox Group controlled requests emit but never overwrite owner values', async () => {
  const root = part('checkbox-group-root', { value: ['a'] }),
    a = part('checkbox-group-item', { value: 'a' }),
    b = part('checkbox-group-item', { value: 'b' });
  root.append(a, b);
  let value: unknown;
  root.addEventListener('valueChange', (e: CustomEvent) => (value = e.detail.value));
  document.body.append(root);
  await flush();
  expect(root.getExposes().requestToggle('b')).toBe(true);
  expect(value).toEqual(['a', 'b']);
  expect(root.getExposes().getValue()).toEqual(['a']);
  b.remove();
  await flush();
  expect(root.getExposes().requestToggle('b')).toBe(false);
});
it('Form serializes registered enabled controls and gates submission on actual validation', async () => {
  const root = part('form-root'),
    a = field({ name: 'name', required: true }, true),
    b = field({ name: 'private', disabled: true }, true);
  root.append(a.root, b.root);
  const results: any[] = [];
  root.addEventListener('submit', (e: CustomEvent) => results.push(e.detail));
  document.body.append(root);
  await flush();
  expect(root.getExposes().getValues()).toEqual({ name: 'ok' });
  expect(root.getExposes().requestSubmit()).toBe(true);
  await flush();
  expect(results).toHaveLength(1);
  expect(results[0].values).toEqual({ name: 'ok' });
  expect(root.getExposes().submitted.get()).toBe(true);
  root.getExposes().resetValidation();
  await flush();
  expect(root.getExposes().submitted.get()).toBe(false);
  expect(a.root.getExposes().getValidity().status).toBe('unvalidated');
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().requestSubmit()).toBe(false);
});
it('Form waits for async validation and cancels when values are replaced', async () => {
  const root = part('form-root'),
    a = field({ name: 'name', externalValidation: true }, true);
  root.append(a.root);
  let request = '';
  a.root.addEventListener('validationRequest', (e: CustomEvent) => (request = e.detail.requestId));
  const results: any[] = [];
  root.addEventListener('submit', (e: CustomEvent) => results.push(e.detail));
  document.body.append(root);
  await flush();
  root.getExposes().requestSubmit();
  await flush();
  expect(root.getExposes().pending.get()).toBe(true);
  expect(results).toHaveLength(0);
  a.root.getExposes().resolveValidation(request, { invalid: false });
  await flush();
  expect(results).toHaveLength(1);
  root.getExposes().requestSubmit();
  await flush();
  const old = request;
  const editor = a.control.shadowRoot?.querySelector('input') ?? a.control.querySelector('input');
  editor.value = 'new';
  editor.dispatchEvent(
    new InputEvent('input', { bubbles: true, composed: true, data: 'new', inputType: 'insertText' })
  );
  await flush();
  expect(a.root.getExposes().resolveValidation(old, { invalid: false })).toBe(false);
  expect(results).toHaveLength(1);
  expect(root.getExposes().pending.get()).toBe(false);
});
