import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';
import { fieldRoot, fieldSwitch, fieldLabel, fieldDescription, fieldError } from '../src/field';
for (const p of [
  switchRoot,
  switchThumb,
  fieldRoot,
  fieldSwitch,
  fieldLabel,
  fieldDescription,
  fieldError,
])
  AdaptToWebComponent(p as any);
const flush = () => new Promise((r) => setTimeout(r, 0));
const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
afterEach(() => document.body.replaceChildren());
function mount(props: Record<string, unknown> = {}) {
  const field = document.createElement(fieldRoot.name) as any,
    root = document.createElement(fieldSwitch.name) as any,
    thumb = document.createElement(switchThumb.name),
    label = document.createElement(fieldLabel.name),
    description = document.createElement(fieldDescription.name),
    error = document.createElement(fieldError.name);
  label.textContent = 'Notifications';
  description.textContent = 'Receive updates';
  setElementProps(root, props);
  root.append(thumb);
  field.append(label, description, root, error);
  document.body.append(field);
  return { field, root, thumb, label, description, error };
}
it('uses one checked owner and inherited Field validity and changing relationships', async () => {
  const m = mount();
  await flush();
  const checked = m.root.getExposes().checked;
  setElementProps(m.field, { invalid: true, errors: ['Invalid toggle'] });
  await flush();
  expect(m.root.getAttribute('aria-invalid')).toBe('true');
  expect(m.root.getAttribute('aria-labelledby')).toBe(m.label.id);
  expect(m.root.getAttribute('aria-describedby')).toBe(m.description.id);
  expect(m.root.getAttribute('aria-errormessage')).toBe(m.error.id);
  click(m.root);
  expect(m.field.getExposes().getValidity().filled).toBe(true);
  expect(checked.get()).toBe(true);
  expect((m.thumb as any).getExposes().checked.get()).toBe(true);
  setElementProps(m.field, { invalid: false });
  await flush();
  expect(m.root.getAttribute('aria-invalid')).toBe('false');
  expect(m.root.hasAttribute('aria-errormessage')).toBe(false);
  const next = document.createElement(fieldDescription.name);
  m.description.remove();
  await flush();
  m.field.append(next);
  await flush();
  expect(m.root.getAttribute('aria-describedby')).toBe(next.id);
  expect(m.root.getExposes().checked).toBe(checked);
});
it.each(['disabled', 'readOnly'])(
  'restores parent and local %s without latching inherited policy',
  async (policy) => {
    const m = mount();
    await flush();
    setElementProps(m.field, { [policy]: true, required: true });
    await flush();
    click(m.root);
    expect(m.root.getExposes().checked.get()).toBe(false);
    expect(m.root.getAttribute('aria-required')).toBe('true');
    if (policy === 'readOnly') {
      m.root.getExposes().focusSelf();
      expect(document.activeElement).toBe(m.root);
    }
    setElementProps(m.field, { [policy]: false, required: false });
    await flush();
    click(m.root);
    expect(m.root.getExposes().checked.get()).toBe(true);
    setElementProps(m.root, { [policy]: true });
    await flush();
    click(m.root);
    expect(m.root.getExposes().checked.get()).toBe(true);
    setElementProps(m.root, { [policy]: false });
    await flush();
    click(m.root);
    expect(m.root.getExposes().checked.get()).toBe(false);
  }
);
it('keeps ordinary Switch unbound and optional no-provider FieldSwitch free of dangling relations', async () => {
  const field = document.createElement(fieldRoot.name),
    plain = document.createElement(switchRoot.name) as any,
    optional = document.createElement(fieldSwitch.name) as any;
  setElementProps(field, { disabled: true, invalid: true });
  field.append(plain);
  document.body.append(field, optional);
  await flush();
  click(plain);
  expect(plain.getExposes().checked.get()).toBe(true);
  expect(plain.hasAttribute('aria-invalid')).toBe(false);
  for (const key of ['aria-labelledby', 'aria-describedby', 'aria-errormessage'])
    expect(optional.hasAttribute(key)).toBe(false);
  click(optional);
  expect(optional.getExposes().checked.get()).toBe(true);
});
it('activates through the existing Field label only once and rejects disabled label activation', async () => {
  const m = mount();
  await flush();
  const changes: boolean[] = [];
  m.root.addEventListener('checkedChange', (e: any) => changes.push(e.detail.checked));
  for (const type of ['pointerdown', 'pointerup'])
    m.label.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  m.label.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
  await flush();
  expect(changes).toEqual([true]);
  setElementProps(m.field, { disabled: true });
  await flush();
  for (const type of ['pointerdown', 'pointerup'])
    m.label.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  m.label.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
  expect(changes).toEqual([true]);
});
it('does not debounce synchronous changes and validates current canonical boolean values', async () => {
  const m = mount();
  setElementProps(m.field, { validationMode: 'onChange', externalValidation: true });
  await flush();
  const changes: boolean[] = [],
    requests: any[] = [];
  m.root.addEventListener('checkedChange', (e: any) => changes.push(e.detail.checked));
  m.field.addEventListener('validationRequest', (e: any) => requests.push(e.detail));
  click(m.root);
  click(m.root);
  expect(changes).toEqual([true, false]);
  await flush();
  expect(requests.map((x) => x.value)).toEqual([false, false]);
});
it('reports only accepted controlled truth, never a rejected proposed value', async () => {
  const m = mount({ checked: false });
  setElementProps(m.field, { validationMode: 'onChange', externalValidation: true });
  await flush();
  const requests: any[] = [];
  m.field.addEventListener('validationRequest', (e: any) => requests.push(e.detail));
  click(m.root);
  await flush();
  expect(requests).toEqual([]);
  m.root.addEventListener('checkedChange', (e: any) =>
    setElementProps(m.root, { checked: e.detail.checked })
  );
  click(m.root);
  await flush();
  expect(m.root.getExposes().checked.get()).toBe(true);
  expect(requests.map((x) => x.value)).toEqual([true]);
});
it('retains duplicate Field control rejection', async () => {
  const m = mount();
  await flush();
  expect(() => m.field.append(document.createElement(fieldSwitch.name))).toThrow(
    /control|duplicate|ambiguous/i
  );
});
it('cancels existing directional preview on Field readOnly and restores the same drag owner', async () => {
  const m = mount({ draggable: true });
  m.root.style.cssText = 'box-sizing:border-box;width:32px;height:20px;border:1px solid;padding:0';
  m.root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 32, height: 20 }) as DOMRect;
  m.thumb.style.cssText = 'width:16px;height:16px';
  m.thumb.getBoundingClientRect = () => ({ left: 1, top: 2, width: 16, height: 16 }) as DOMRect;
  await flush();
  const send = (type: string, x = 9) =>
    m.root.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: 10,
        detail: 1,
      })
    );
  const api = m.root.getExposes(),
    changes: boolean[] = [];
  m.root.addEventListener('checkedChange', (e: any) => changes.push(e.detail.checked));
  send('pointerdown');
  send('pointermove', 16);
  expect(api.dragging.get()).toBe(true);
  expect(api.percentage.get()).toBe(50);
  setElementProps(m.field, { readOnly: true });
  await flush();
  expect(api.dragging.get()).toBe(false);
  expect(api.percentage.get()).toBe(0);
  send('pointerup', 23);
  send('click', 23);
  expect(changes).toEqual([]);
  expect(api.checked.get()).toBe(false);
  setElementProps(m.field, { readOnly: false });
  await flush();
  send('pointerdown');
  send('pointermove', 23);
  send('pointerup', 23);
  send('click', 23);
  expect(changes).toEqual([true]);
  expect(m.root.getExposes().checked).toBe(api.checked);
});
it('cancels an already queued change notification when its control is removed', async () => {
  const m = mount();
  setElementProps(m.field, { validationMode: 'onChange', externalValidation: true });
  await flush();
  const requests: unknown[] = [];
  m.field.addEventListener('validationRequest', (e: any) => requests.push(e.detail));
  click(m.root);
  expect(m.root.getExposes().checked.get()).toBe(true);
  m.root.remove();
  await flush();
  expect(requests).toEqual([]);
  const replacement = document.createElement(fieldSwitch.name) as any;
  m.field.append(replacement);
  await flush();
  expect(replacement.getExposes().checked.get()).toBe(false);
  expect(replacement.getAttribute('aria-labelledby')).toBe(m.label.id);
  click(replacement);
  await flush();
  expect(requests).toHaveLength(1);
});
