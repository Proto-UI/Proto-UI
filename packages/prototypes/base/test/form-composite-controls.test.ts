import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as form from '../src/form';
import * as field from '../src/field';
import * as fieldset from '../src/fieldset';
import * as slider from '../src/slider';
import * as number from '../src/number-field';
import * as otp from '../src/input-otp';
import * as checkbox from '../src/checkbox-group';
for (const group of [form, field, fieldset, slider, number, otp, checkbox])
  for (const p of Object.values(group))
    if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const part = (name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement('base-' + name) as any;
  setElementProps(el, props);
  return el;
};
const editor = (el: any) => el.shadowRoot?.querySelector('input') ?? el.querySelector('input');
const type = async (el: any, value: string) => {
  const input = editor(el);
  input.value = value;
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value })
  );
  await flush();
};
const makeField = (name: string, root: any, props: Record<string, unknown> = {}) => {
  const container = part('form-field', { name, ...props }),
    label = part('field-label');
  label.textContent = name;
  container.append(label, root);
  return { container, label };
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it('Form resets actual uncontrolled editors and validation, including disabled fields, while controlled reset only proposes', async () => {
  const root = part('form-root'),
    reset = part('form-reset');
  const a = part('field-control', { defaultValue: 'initial' });
  const b = part('field-control', { value: 'owned' });
  const fa = makeField('a', a),
    fb = makeField('b', b);
  root.append(fa.container, fb.container, reset);
  document.body.append(root);
  await flush();
  await type(a, 'changed');
  setElementProps(b, { value: 'next' });
  await flush();
  setElementProps(fa.container, { name: 'a', disabled: true });
  await flush();
  let proposed: any;
  b.addEventListener('valueChange', (e: CustomEvent) => {
    proposed = e.detail.value;
  });
  let resets = 0;
  root.addEventListener('reset', () => {
    resets++;
  });
  reset.click();
  await flush();
  expect(editor(a).value).toBe('initial');
  expect(a.getExposes().value.get()).toBe('initial');
  expect(editor(b).value).toBe('next');
  expect(proposed).toBe('owned');
  expect(resets).toBe(1);
  expect(root.getExposes().submitted.get()).toBe(false);
  expect(fa.container.getExposes().getValidity().status).toBe('unvalidated');
});
it('Form implicit Enter submits a focused single editor but ignores composition, modifiers, repeated and unrelated keys', async () => {
  const root = part('form-root'),
    control = part('field-control', { defaultValue: 'ok' });
  root.append(makeField('name', control).container);
  document.body.append(root);
  await flush();
  const results: any[] = [];
  root.addEventListener('submit', (e: CustomEvent) => results.push(e.detail));
  control.getExposes().focusSelf();
  await flush();
  const input = editor(control);
  for (const options of [
    { key: 'Enter', shiftKey: true },
    { key: 'Enter', repeat: true },
    { key: 'Escape' },
  ]) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { ...options, bubbles: true, composed: true })
    );
    await flush();
    expect(results, JSON.stringify(options)).toHaveLength(0);
  }
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true }));
  await flush();
  expect(control.getExposes().__implicitSubmitEligible()).toBe(false);
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
  );
  await flush();
  expect(results).toHaveLength(0);
  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true }));
  await flush();
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  await flush();
  expect(results).toHaveLength(1);
  expect(results[0].values).toEqual({ name: 'ok' });
  expect(event.defaultPrevented).toBe(true);
});
it('Number, OTP, Slider and Checkbox Group serialize canonical typed values and reset through Field', async () => {
  const root = part('form-root');
  const nr = part('number-field-root', { defaultValue: 2 }),
    nc = part('number-field-control');
  nr.append(nc);
  const or = part('input-otp-root', { defaultValue: '12' }),
    oc = part('input-otp-control');
  or.append(oc);
  const sr = part('slider-root', { defaultValue: 20 }),
    st = part('slider-track'),
    sc = part('slider-field-thumb');
  st.append(sc);
  sr.append(st);
  const cr = part('checkbox-group-root', { defaultValue: ['a'] }),
    ca = part('checkbox-group-item', { value: 'a' }),
    cb = part('checkbox-group-item', { value: 'b' });
  cr.append(ca, cb);
  const fields = [
    makeField('number', nr),
    makeField('otp', or),
    makeField('slider', sr),
    makeField('choices', cr),
  ];
  root.append(...fields.map((f) => f.container));
  document.body.append(root);
  await flush();
  expect(root.getExposes().getValues()).toEqual({
    number: 2,
    otp: '12',
    slider: 20,
    choices: ['a'],
  });
  expect(editor(nc).getAttribute('aria-labelledby')).toBe(fields[0].label.id);
  expect(editor(oc).getAttribute('aria-labelledby')).toBe(fields[1].label.id);
  expect(sc.getAttribute('aria-labelledby')).toBe(fields[2].label.id);
  fields[0].label.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  fields[0].label.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  fields[0].label.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
  await flush();
  expect(nc.getExposes().focused.get()).toBe(true);
  await type(nc, '4');
  await type(oc, '345');
  sr.getExposes().requestValue(70);
  cr.getExposes().requestToggle('b');
  await flush();
  expect(root.getExposes().getValues()).toEqual({
    number: 4,
    otp: '345',
    slider: 70,
    choices: ['a', 'b'],
  });
  expect(root.getExposes().requestReset()).toBe(true);
  await flush();
  expect(root.getExposes().getValues()).toEqual({
    number: 2,
    otp: '12',
    slider: 20,
    choices: ['a'],
  });
  expect(editor(nc).value).toBe('2');
  expect(editor(oc).value).toBe('12');
});
it('Composite control disabled policy survives ancestor enable without latching inherited disabled', async () => {
  const root = part('form-root');
  const nr = part('number-field-root'),
    nc = part('number-field-control');
  nr.append(nc);
  const sr = part('slider-root', { disabled: true }),
    st = part('slider-track'),
    sc = part('slider-field-thumb');
  st.append(sc);
  sr.append(st);
  const f1 = makeField('number', nr),
    f2 = makeField('slider', sr);
  root.append(f1.container, f2.container);
  document.body.append(root);
  await flush();
  setElementProps(root, { disabled: true });
  await flush();
  expect(editor(nc).disabled).toBe(true);
  expect(nr.getExposes().requestValue(30)).toBe(false);
  setElementProps(root, { disabled: false });
  await flush();
  expect(editor(nc).disabled).toBe(false);
  expect(sr.getExposes().disabled.get()).toBe(true);
  expect(f2.container.getExposes().disabled.get()).toBe(true);
  setElementProps(sr, { disabled: false });
  await flush();
  expect(sr.getExposes().disabled.get()).toBe(false);
  expect(f2.container.getExposes().disabled.get()).toBe(false);
});
it('Nested Fieldsets combine all ancestor disabled policy and preserve each local choice', async () => {
  const outer = part('fieldset-root'),
    middle = part('fieldset-root'),
    inner = part('fieldset-root');
  const f = part('field-root'),
    c = part('field-control');
  f.append(c);
  inner.append(f);
  middle.append(inner);
  outer.append(middle);
  document.body.append(outer);
  await flush();
  setElementProps(outer, { disabled: true });
  await flush();
  for (const p of [outer, middle, inner, f]) expect(p.getExposes().disabled.get()).toBe(true);
  expect(editor(c).disabled).toBe(true);
  setElementProps(middle, { disabled: true });
  setElementProps(outer, { disabled: false });
  await flush();
  expect(outer.getExposes().disabled.get()).toBe(false);
  expect(editor(c).disabled).toBe(true);
  setElementProps(middle, { disabled: false });
  await flush();
  expect(editor(c).disabled).toBe(false);
  setElementProps(inner, { disabled: true });
  setElementProps(outer, { disabled: true });
  await flush();
  setElementProps(outer, { disabled: false });
  await flush();
  expect(editor(c).disabled).toBe(true);
});
it.each(['number-field', 'input-otp'])(
  '%s composition retires pending validation and reset cancels editing without stale submit',
  async (component) => {
    const form = part('form-root'),
      root = part(component + '-root', { defaultValue: component === 'number-field' ? 2 : '12' }),
      control = part(component + '-control');
    root.append(control);
    const f = makeField('value', root, { externalValidation: true });
    form.append(f.container);
    document.body.append(form);
    await flush();
    const request = f.container.getExposes().validate();
    expect(f.container.getExposes().pending.get()).toBe(true);
    editor(control).dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true })
    );
    await flush();
    expect(f.container.getExposes().pending.get()).toBe(false);
    expect(f.container.getExposes().resolveValidation(request, { invalid: false })).toBe(false);
    expect(form.getExposes().requestReset()).toBe(true);
    await flush();
    expect(editor(control).value).toBe(component === 'number-field' ? '2' : '12');
    expect(control.getExposes().__fieldSnapshot().composing).toBe(false);
  }
);
it('Number increment requests trigger Field onChange validation of the canonical number', async () => {
  const form = part('form-root'),
    root = part('number-field-root', { defaultValue: 2 }),
    control = part('number-field-control');
  root.append(control);
  const f = makeField('quantity', root, { validationMode: 'onChange', externalValidation: true });
  form.append(f.container);
  document.body.append(form);
  await flush();
  const requests: any[] = [];
  f.container.addEventListener('validationRequest', (e: CustomEvent) => requests.push(e.detail));
  root.getExposes().stepBy(1);
  await flush();
  expect(requests).toHaveLength(1);
  expect(requests[0].value).toBe(3);
});
it('Checkbox Group bridges required validation and one group blur rather than internal focus moves', async () => {
  const form = part('form-root'),
    group = part('checkbox-group-root'),
    a = part('checkbox-group-item', { value: 'a' }),
    b = part('checkbox-group-item', { value: 'b' });
  group.append(a, b);
  const f = makeField('choices', group, { required: true });
  form.append(f.container);
  document.body.append(form);
  await flush();
  form.getExposes().requestSubmit();
  await flush();
  expect(f.container.getExposes().getValidity().invalid).toBe(true);
  f.container.getExposes().resetValidation();
  group.getExposes().focusSelf();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await flush();
  expect(a.getExposes().focused.get()).toBe(true);
  b.getExposes().focusSelf();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await flush();
  expect(f.container.getExposes().getValidity().status).toBe('unvalidated');
  group.getExposes().requestToggle('b');
  await flush();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await flush();
  expect(f.container.getExposes().getValidity().status).toBe('valid');
  expect(form.getExposes().getValues()).toEqual({ choices: ['b'] });
});
