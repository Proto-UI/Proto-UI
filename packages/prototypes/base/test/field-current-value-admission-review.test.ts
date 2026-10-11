import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldRoot, fieldControl } from '../src/field';
for (const prototype of [fieldRoot, fieldControl]) AdaptToWebComponent(prototype);
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
async function fixture(controlProps = { defaultValue: 'initial' }, rootProps = {}) {
  const root = document.createElement('base-field-root') as any,
    control = document.createElement('base-field-control') as any;
  setElementProps(root, { externalValidation: true, validationMode: 'manual', ...rootProps });
  setElementProps(control, controlProps);
  root.append(control);
  document.body.append(root);
  for (let i = 0; i < 25 && !control.querySelector('input'); i++) {
    await flush();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  const editor = control.querySelector('input') as HTMLInputElement;
  expect(editor).toBeTruthy();
  return { root, control, editor, api: root.getExposes(), controlApi: control.getExposes() };
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
describe('Field PR review canonical change and result admission', () => {
  it('accepts an uncontrolled change-only canonical value and retires validation of the old value', async () => {
    const f = await fixture();
    const request = f.api.validate();
    const changes: unknown[] = [];
    f.control.addEventListener('change', (event: CustomEvent) => changes.push(event.detail));
    f.editor.value = 'committed';
    f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await flush();
    expect(changes).toEqual([{ value: 'committed' }]);
    expect(f.controlApi.value.get()).toBe('committed');
    expect(f.api.dirty.get()).toBe(true);
    expect(f.api.filled.get()).toBe(true);
    expect(f.api.resolveValidation(request, { invalid: true })).toBe(false);
    const next = f.api.validate();
    expect(next).not.toBe(request);
  });
  it('reports empty change-only values and applies explicit onChange validation', async () => {
    const f = await fixture(
      { defaultValue: 'initial' },
      { required: true, validationMode: 'onChange', externalValidation: false }
    );
    f.editor.value = '';
    f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await flush();
    expect(f.controlApi.value.get()).toBe('');
    expect(f.api.filled.get()).toBe(false);
    expect(f.api.invalid.get()).toBe(true);
  });
  it('reports a controlled owner acceptance after the change callback and preserves rejection', async () => {
    const f = await fixture({ value: 'owner' } as any);
    const request = f.api.validate();
    f.editor.value = 'rejected';
    f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await flush();
    expect(f.controlApi.value.get()).toBe('owner');
    expect(f.api.resolveValidation(request, { invalid: false })).toBe(true);
    const next = f.api.validate();
    f.control.addEventListener('change', (event: CustomEvent) =>
      setElementProps(f.control, { value: event.detail.value })
    );
    f.editor.value = 'accepted';
    f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await flush();
    expect(f.controlApi.value.get()).toBe('accepted');
    expect(f.api.dirty.get()).toBe(true);
    expect(f.api.resolveValidation(next, { invalid: true })).toBe(false);
  });
  it.each([
    ['inherited discriminator', () => Object.create({ invalid: true })],
    [
      'foreign prototype errors',
      () => Object.assign(Object.create({ errors: ['inherited'] }), { invalid: true }),
    ],
    ['array record', () => Object.assign([], { invalid: true })],
    ['symbol field', () => ({ invalid: true, [Symbol('foreign')]: 'value' })],
  ] as const)('refuses %s without spending the pending request', async (_name, result) => {
    const f = await fixture();
    const request = f.api.validate();
    expect(f.api.resolveValidation(request, result())).toBe(false);
    expect(f.api.pending.get()).toBe(true);
    expect(f.api.resolveValidation(request, { invalid: false })).toBe(true);
  });
  it('ignores an inherited optional error on Object.prototype without reading it', async () => {
    const f = await fixture();
    const request = f.api.validate();
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'errors');
    let reads = 0;
    Object.defineProperty(Object.prototype, 'errors', {
      configurable: true,
      get() {
        reads++;
        return ['polluted'];
      },
    });
    try {
      expect(f.api.resolveValidation(request, { invalid: true })).toBe(true);
      expect(f.api.getValidity().errors).toEqual([]);
      expect(reads).toBe(0);
    } finally {
      if (previous) Object.defineProperty(Object.prototype, 'errors', previous);
      else Reflect.deleteProperty(Object.prototype, 'errors');
    }
  });
  it('independent: valid null-prototype result is accepted', async () => {
    const f = await fixture();
    const request = f.api.validate();
    expect(f.api.resolveValidation(request, Object.assign(Object.create(null), { invalid: true, errors: ['owned'] }))).toBe(true);
    expect(f.api.getValidity().errors).toEqual(['owned']);
  });
  it('independent: a result getter cannot spend a replacement validation lease', async () => {
    const f = await fixture();
    const old = f.api.validate();
    let successor: string | null = null;
    const result = { get invalid() { successor = f.api.validate(); return true; }, errors: ['stale'] };
    expect(f.api.resolveValidation(old, result)).toBe(false);
    expect(successor).not.toBe(old);
    expect(f.api.pending.get()).toBe(true);
    expect(f.api.resolveValidation(successor, { invalid: false })).toBe(true);
    expect(f.api.getValidity().errors).toEqual([]);
  });
  it('independent: throwing own result getter preserves pending validation', async () => {
    const f = await fixture();
    const request = f.api.validate();
    const result = { get invalid() { throw new Error('getter abort'); } };
    expect(() => f.api.resolveValidation(request, result)).toThrow('getter abort');
    expect(f.api.pending.get()).toBe(true);
    expect(f.api.resolveValidation(request, { invalid: false })).toBe(true);
  });

});
