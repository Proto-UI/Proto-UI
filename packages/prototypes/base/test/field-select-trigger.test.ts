import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { selectRoot, selectTrigger } from '../src/select';
import {
  fieldRoot,
  fieldSelectTrigger,
  fieldLabel,
  fieldDescription,
  fieldError,
} from '../src/field';
for (const p of [
  selectRoot,
  selectTrigger,
  fieldRoot,
  fieldSelectTrigger,
  fieldLabel,
  fieldDescription,
  fieldError,
])
  AdaptToWebComponent(p as any);
const flush = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => document.body.replaceChildren());
function mount() {
  const field = document.createElement(fieldRoot.name),
    root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(fieldSelectTrigger.name) as any,
    label = document.createElement(fieldLabel.name),
    description = document.createElement(fieldDescription.name),
    error = document.createElement(fieldError.name);
  label.textContent = 'Choice';
  description.textContent = 'Choose carefully';
  setElementProps(root, { defaultValue: 'alpha' });
  root.append(trigger);
  field.append(label, description, root, error);
  document.body.append(field);
  return { field, root, trigger, label, description, error };
}
it('uses one canonical Field binding for invalid and relationship updates without changing selection', async () => {
  const m = mount();
  await flush();
  const value = m.root.getExposes().value;
  setElementProps(m.field, { invalid: true, errors: ['Invalid choice'] });
  await flush();
  expect(m.trigger.getAttribute('aria-invalid')).toBe('true');
  expect(m.trigger.getAttribute('aria-labelledby')).toBe(m.label.id);
  expect(m.trigger.getAttribute('aria-describedby')).toBe(m.description.id);
  expect(m.trigger.getAttribute('aria-errormessage')).toBe(m.error.id);
  expect(value.get()).toBe('alpha');
  setElementProps(m.field, { invalid: false });
  await flush();
  expect(m.trigger.getAttribute('aria-invalid')).toBe('false');
  expect(m.trigger.hasAttribute('aria-errormessage')).toBe(false);
  expect(m.root.getExposes().value).toBe(value);
});
it('gates root selection on local Field trigger readOnly without disabling keyboard focus', async () => {
  const m = mount();
  await flush();
  setElementProps(m.trigger, { readOnly: true });
  await flush();
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(false);
  expect(m.trigger.getAttribute('aria-readonly')).toBe('true');
  m.trigger.getExposes().focusSelf();
  expect(document.activeElement).toBe(m.trigger);
  setElementProps(m.trigger, { readOnly: false });
  await flush();
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(true);
  expect(m.root.getExposes().value.get()).toBe('beta');
});
it('restores disabled and required from parent without latching inherited policy as local policy', async () => {
  const m = mount();
  await flush();
  setElementProps(m.field, { disabled: true, required: true });
  await flush();
  expect(m.trigger.getAttribute('aria-disabled')).toBe('true');
  expect(m.trigger.getAttribute('aria-required')).toBe('true');
  m.label.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(document.activeElement).not.toBe(m.trigger);
  setElementProps(m.field, { disabled: false, required: false });
  await flush();
  expect(m.trigger.getAttribute('aria-disabled')).toBe('false');
  expect(m.trigger.getAttribute('aria-required')).toBe('false');
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(true);
});
it('keeps a plain trigger content-labelled and outside optional Field composition', async () => {
  const field = document.createElement(fieldRoot.name),
    root = document.createElement(selectRoot.name),
    trigger = document.createElement(selectTrigger.name);
  trigger.textContent = 'Native name';
  root.append(trigger);
  field.append(root);
  setElementProps(field, { invalid: true });
  document.body.append(field);
  await flush();
  expect(trigger.getAttribute('role')).toBe('combobox');
  expect(trigger.hasAttribute('aria-invalid')).toBe(false);
  expect(trigger.hasAttribute('aria-labelledby')).toBe(false);
});
it('retains canonical controlled value when a value request is refused and survives provider replacement', async () => {
  const m = mount();
  setElementProps(m.root, { value: 'alpha' });
  await flush();
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(true);
  expect(m.root.getExposes().value.get()).toBe('alpha');
  setElementProps(m.field, { invalid: true });
  await flush();
  const next = document.createElement(fieldRoot.name);
  m.root.remove();
  m.field.remove();
  next.append(m.root);
  document.body.append(next);
  await flush();
  expect(m.trigger.getAttribute('aria-invalid')).toBe('false');
  expect(m.root.getExposes().value.get()).toBe('alpha');
});
it('retires reports after a synchronous owner valueChange removes the Select view', async () => {
  const m = mount();
  setElementProps(m.field, { validationMode: 'onChange', externalValidation: true });
  await flush();
  let validationsAfterOutward = 0;
  let outward = false;
  m.field.addEventListener('validationRequest', () => {
    if (outward) validationsAfterOutward++;
  });
  let requests = 0;
  m.root.addEventListener('valueChange', () => {
    requests++;
    outward = true;
    m.root.remove();
  });
  expect(() =>
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).not.toThrow();
  await flush();
  expect(requests).toBe(1);
  expect(m.root.isConnected).toBe(false);
  expect((m.field as any).getExposes().getValidity().filled).toBe(false);
  expect(validationsAfterOutward).toBe(0);
});
it('works without a Field provider and does not emit dangling Field relationships', async () => {
  const root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(fieldSelectTrigger.name) as any;
  root.append(trigger);
  document.body.append(root);
  await flush();
  expect(trigger.getAttribute('aria-invalid')).toBe('false');
  for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-errormessage'])
    expect(trigger.hasAttribute(attr)).toBe(false);
  expect(
    root.getExposes().requestValue({ value: 'alpha', textValue: 'Alpha', reason: 'keyboard' })
  ).toBe(true);
});
it('removing local disabled restores the root request gate without a policy feedback latch', async () => {
  const m = mount();
  await flush();
  setElementProps(m.trigger, { disabled: true });
  await flush();
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(false);
  setElementProps(m.trigger, { disabled: false });
  await flush();
  expect(m.trigger.getAttribute('aria-disabled')).toBe('false');
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(true);
});
it('preserves the existing Field duplicate-control rejection', async () => {
  const m = mount();
  await flush();
  const second = document.createElement(selectRoot.name),
    trigger = document.createElement(fieldSelectTrigger.name);
  second.append(trigger);
  expect(() => m.field.append(second)).toThrow(/control|duplicate|ambiguous/i);
});
it('keeps every accepted user change synchronous and validates through current Field leases without debounce', async () => {
  const m = mount();
  setElementProps(m.field, { externalValidation: true, validationMode: 'onChange' });
  await flush();
  const changes: string[] = [],
    validations: any[] = [];
  m.root.addEventListener('valueChange', (e: any) => changes.push(e.detail.value));
  m.field.addEventListener('validationRequest', (e: any) => validations.push(e.detail));
  const api = m.root.getExposes();
  api.requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' });
  api.requestValue({ value: 'gamma', textValue: 'Gamma', reason: 'keyboard' });
  expect(changes).toEqual(['beta', 'gamma']);
  expect(api.value.get()).toBe('gamma');
  await flush();
  expect(validations).toHaveLength(2);
  expect(validations.map((x) => x.value)).toEqual(['gamma', 'gamma']);
  expect(
    (m.field as any).getExposes().resolveValidation(validations[0].requestId, { invalid: false })
  ).toBe(false);
  expect(
    (m.field as any).getExposes().resolveValidation(validations[1].requestId, { invalid: false })
  ).toBe(true);
});
it('rejecting a controlled request does not validate a proposed value and synchronous acceptance validates the actual value', async () => {
  const m = mount();
  setElementProps(m.field, { externalValidation: true, validationMode: 'onChange' });
  setElementProps(m.root, { value: 'alpha' });
  await flush();
  const validations: any[] = [];
  m.field.addEventListener('validationRequest', (e: any) => validations.push(e.detail));
  m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' });
  await flush();
  expect(validations).toEqual([]);
  m.root.addEventListener('valueChange', () => setElementProps(m.root, { value: 'accepted' }));
  m.root.getExposes().requestValue({ value: 'gamma', textValue: 'Gamma', reason: 'keyboard' });
  await flush();
  expect(m.root.getExposes().value.get()).toBe('accepted');
  expect(validations.map((x) => x.value)).toEqual(['accepted']);
});
