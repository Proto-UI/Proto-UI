import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldRoot, fieldControl } from '../src/field';
AdaptToWebComponent(fieldRoot);
AdaptToWebComponent(fieldControl);
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.unstubAllGlobals();
});
describe('Field explicit public protocol boundaries', () => {
  // T-BASE-FIELD-0001-CASE-BOUNDS
  it('does not acquire Form submission/reset/serialization APIs or hidden form controls', async () => {
    const root = document.createElement(fieldRoot.name) as any,
      control = document.createElement(fieldControl.name) as any;
    setElementProps(control, { defaultValue: 'retained value' });
    root.append(control);
    document.body.append(root);
    await flush();
    const exposed = root.getExposes();
    for (const name of ['submit', 'reset', 'resetForm', 'getFormData', 'serialize', 'setValue'])
      expect(exposed).not.toHaveProperty(name);
    expect(root.querySelector('form,input[type="hidden"]')).toBeNull();
    exposed.resetValidation();
    await flush();
    expect(control.getExposes().value.get()).toBe('retained value');
  });
  it('leaves asynchronous execution to the consumer until the matching explicit result', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const root = document.createElement(fieldRoot.name) as any,
      control = document.createElement(fieldControl.name) as any;
    setElementProps(root, { externalValidation: true, validationMode: 'manual' });
    setElementProps(control, { defaultValue: 'owned' });
    root.append(control);
    document.body.append(root);
    await flush();
    const request = root.getExposes().validate();
    await flush();
    expect(typeof request).toBe('string');
    expect(root.getExposes().pending.get()).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(root.getExposes().resolveValidation(request, { invalid: false })).toBe(true);
    expect(root.getExposes().pending.get()).toBe(false);
  });
});
