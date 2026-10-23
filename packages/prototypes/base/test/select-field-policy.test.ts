import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { selectRoot, selectTrigger } from '../src/select';
import { fieldRoot } from '../src/field';
for (const p of [selectRoot, selectTrigger, fieldRoot]) AdaptToWebComponent(p as any);
const flush = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => document.body.replaceChildren());
it('rejects selection at the owning Root after an already-open Field becomes readOnly', async () => {
  const field = document.createElement(fieldRoot.name),
    root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(selectTrigger.name);
  setElementProps(root, { defaultValue: 'alpha', defaultOpen: true });
  root.append(trigger);
  field.append(root);
  document.body.append(field);
  await flush();
  const api = root.getExposes(),
    value = api.value;
  expect(value.get()).toBe('alpha');
  expect(api.open.get()).toBe(true);
  setElementProps(field, { readOnly: true });
  await flush();
  expect(api.requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })).toBe(false);
  expect(value.get()).toBe('alpha');
  expect(api.value).toBe(value);
  setElementProps(field, { readOnly: false });
  await flush();
  expect(api.requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })).toBe(true);
  expect(value.get()).toBe('beta');
});
it('uses Field disabled at the actual request gate and restores local policy on provider change', async () => {
  const field = document.createElement(fieldRoot.name),
    root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(selectTrigger.name);
  root.append(trigger);
  field.append(root);
  document.body.append(field);
  await flush();
  setElementProps(field, { disabled: true });
  await flush();
  expect(
    root.getExposes().requestOpen({ open: true, reason: 'test', focusReason: 'programmatic' })
  ).toBe(false);
  expect(trigger.getAttribute('aria-disabled')).toBe('true');
  setElementProps(root, { disabled: true });
  setElementProps(field, { disabled: false });
  await flush();
  expect(
    root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(false);
});
