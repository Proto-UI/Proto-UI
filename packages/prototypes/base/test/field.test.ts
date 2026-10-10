import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  fieldRoot,
  fieldControl,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldValidity,
  asFieldControl,
} from '../src/field';
for (const proto of [
  fieldRoot,
  fieldControl,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldValidity,
])
  AdaptToWebComponent(proto);
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
async function until(predicate: () => boolean) {
  for (let i = 0; i < 25; i++) {
    await flush();
    if (predicate()) return;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  throw Error('Field did not settle.');
}
function part(role: string, props: Record<string, unknown> = {}) {
  const el = document.createElement(`base-field-${role}`) as any;
  setElementProps(el, props);
  return el;
}
function fixture(props: Record<string, unknown> = {}, controlProps: Record<string, unknown> = {}) {
  const root = part('root', props),
    control = part('control', controlProps),
    label = part('label'),
    description = part('description'),
    error = part('error'),
    validity = part('validity');
  label.textContent = 'Account name';
  description.textContent = 'Shown on your profile';
  root.append(label, control, description, error, validity);
  const requests: any[] = [],
    results: any[] = [];
  root.addEventListener('validationRequest', (e: CustomEvent) => requests.push(e.detail));
  root.addEventListener('validityChange', (e: CustomEvent) => results.push(e.detail));
  return { root, control, label, description, error, validity, requests, results };
}
function editor(f: ReturnType<typeof fixture>) {
  return (f.control.shadowRoot?.querySelector('input') ??
    f.control.querySelector('input')) as HTMLInputElement;
}
async function mount(f: ReturnType<typeof fixture>) {
  document.body.append(f.root);
  await until(() => !!editor(f));
  return f;
}
function pointerClick(el: HTMLElement) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  el.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}
async function input(f: ReturnType<typeof fixture>, value: string) {
  const e = editor(f);
  e.value = value;
  e.dispatchEvent(
    new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value })
  );
  await flush();
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
describe('Base Field canonical ownership and lifecycle', () => {
  it('links one actual editor to label, description and current error, without phantom validation', async () => {
    const f = await mount(fixture({ required: true }));
    const e = editor(f);
    expect(e.getAttribute('aria-labelledby')).toBe(f.label.id);
    expect(e.getAttribute('aria-describedby')).toBe(f.description.id);
    expect(e.required).toBe(true);
    expect(e.getAttribute('aria-required')).toBe('true');
    expect(f.root.getExposes().getValidity().status).toBe('unvalidated');
    expect(f.results).toEqual([]);
    f.root.getExposes().validate();
    await until(() => f.error.getExposes().hidden.get() === false);
    expect(e.getAttribute('aria-invalid')).toBe('true');
    expect(e.getAttribute('aria-errormessage')).toBe(f.error.id);
    expect(f.error.textContent).toContain('required');
    await input(f, 'Ada');
    f.root.getExposes().validate();
    await flush();
    expect(e.getAttribute('aria-invalid')).toBe('false');
    expect(e.hasAttribute('aria-errormessage')).toBe(false);
    expect(f.root.getExposes().getValidity().dirty).toBe(true);
  });
  it('validates on blur, tracks focus/touched and keeps readonly focusable while disabled suppresses editing', async () => {
    const f = await mount(fixture({ required: true }));
    editor(f).focus();
    await flush();
    expect(f.root.getExposes().focused.get()).toBe(true);
    editor(f).blur();
    await flush();
    expect(f.root.getExposes().touched.get()).toBe(true);
    expect(f.root.getExposes().invalid.get()).toBe(true);
    setElementProps(f.root, { required: true, readOnly: true });
    await flush();
    expect(editor(f).readOnly).toBe(true);
    expect(editor(f).disabled).toBe(false);
    setElementProps(f.root, { required: true, disabled: true });
    await flush();
    expect(editor(f).disabled).toBe(true);
    expect(f.root.getExposes().validate()).toBeNull();
    expect(f.root.getExposes().focusControl()).toBe(false);
    setElementProps(f.root, { required: true });
    await flush();
    expect(editor(f).disabled).toBe(false);
    expect(editor(f).readOnly).toBe(false);
  });
  it('rejects stale async completions on new value, repeated requests, disable, removal and replacement', async () => {
    const f = await mount(
      fixture({ externalValidation: true, validationMode: 'manual' }, { defaultValue: 'a' })
    );
    const root = f.root.getExposes();
    const a = root.validate();
    expect(f.requests.at(-1)).toEqual({ requestId: a, value: 'a', reason: 'manual' });
    expect(root.pending.get()).toBe(true);
    expect(root.getValidity().status).toBe('unvalidated');
    await input(f, 'b');
    expect(root.resolveValidation(a, { invalid: true, errors: ['stale'] })).toBe(false);
    const b = root.validate(),
      c = root.validate();
    expect(root.resolveValidation(b, { invalid: true })).toBe(false);
    expect(root.resolveValidation(c, { invalid: true, errors: ['Unavailable'] })).toBe(true);
    await flush();
    expect(root.invalid.get()).toBe(true);
    const d = root.validate();
    setElementProps(f.root, { externalValidation: true, disabled: true });
    await flush();
    expect(root.resolveValidation(d, { invalid: false })).toBe(false);
    setElementProps(f.root, { externalValidation: true });
    await flush();
    const e = root.validate();
    f.control.remove();
    await flush();
    expect(root.resolveValidation(e, { invalid: false })).toBe(false);
    expect(root.validate()).toBeNull();
    expect(root.getValidity().status).toBe('unvalidated');
    const replacement = part('control', { defaultValue: 'b' });
    f.root.insertBefore(replacement, f.description);
    await until(() => !!replacement.getExposes?.().value);
    expect(root.resolveValidation(e, { invalid: false })).toBe(false);
    expect(root.getValidity().dirty).toBe(false);
  });
  it('controlled values remain canonical after rejected edits; controlled invalidity never changes optimistically', async () => {
    const f = await mount(
      fixture(
        { invalid: false, externalValidation: true, validationMode: 'onChange' },
        { value: 'canonical' }
      )
    );
    await input(f, 'attempt');
    expect(editor(f).value).toBe('canonical');
    expect(f.root.getExposes().getValidity().dirty).toBe(false);
    expect(f.requests.at(-1).value).toBe('canonical');
    expect(
      f.root
        .getExposes()
        .resolveValidation(f.requests.at(-1).requestId, { invalid: true, errors: ['Rejected'] })
    ).toBe(true);
    expect(f.root.getExposes().invalid.get()).toBe(false);
    setElementProps(f.root, { invalid: true, errors: ['Owner error'], externalValidation: true });
    await flush();
    expect(f.root.getExposes().invalid.get()).toBe(true);
    expect(f.error.textContent).toBe('Owner error');
  });
  it('nested roots isolate equal field values and a detached root cannot resolve its request', async () => {
    const a = fixture({ externalValidation: true }, { defaultValue: 'same' }),
      b = fixture({ externalValidation: true }, { defaultValue: 'same' });
    a.root.append(b.root);
    await mount(a);
    await until(() => !!editor(b));
    const first = a.root.getExposes().validate(),
      second = b.root.getExposes().validate();
    expect(a.root.getExposes().resolveValidation(second, { invalid: true })).toBe(false);
    expect(b.root.getExposes().resolveValidation(first, { invalid: true })).toBe(false);
    const exposes = a.root.getExposes();
    a.root.remove();
    await flush();
    let result;
    try {
      result = exposes.resolveValidation(first, { invalid: true });
    } catch {
      result = false;
    }
    expect(result).toBe(false);
  });
});

let customSequence = 0;
function genericFixture(value: unknown, rootProps: Record<string, unknown> = {}) {
  const root = part('root', { required: true, ...rootProps });
  const proto = definePrototype({
    name: `field-generic-${++customSequence}`,
    setup(def) {
      const field = asFieldControl();
      def.lifecycle.onCreated(() => field.report({ value: value as any }));
    },
  });
  AdaptToWebComponent(proto);
  const control = document.createElement(proto.name) as any;
  root.append(control);
  return { root, control };
}
describe('Field finite value and negative boundaries', () => {
  it.each([
    [0, false],
    [' ', false],
    ['', true],
    [false, true],
    [true, false],
    [[], true],
    [[''], false],
    [null, true],
  ])(
    'required semantics for %j are explicit, with no trim or string coercion',
    async (value, invalid) => {
      const f = genericFixture(value);
      document.body.append(f.root);
      await flush();
      f.root.getExposes().validate();
      expect(f.root.getExposes().invalid.get()).toBe(invalid);
    }
  );
  it('generic bridge refuses non-finite, object, nonstring-array and callback values without poisoning canonical validity', async () => {
    const f = genericFixture('accepted', { externalValidation: true });
    document.body.append(f.root);
    await flush();
    const root = f.root.getExposes(),
      control = f.control.getExposes();
    const request = root.validate();
    for (const value of [Infinity, NaN, {}, [1], () => {}, undefined])
      expect(control.reportField({ value, reason: 'input' })).toBe(false);
    expect(root.resolveValidation(request, { invalid: false })).toBe(true);
  });
  it('length is explicit UTF-16 string length and optional empty values bypass length', async () => {
    const f = await mount(fixture({ minLength: 3, maxLength: 4, validationMode: 'onChange' }));
    f.root.getExposes().validate();
    expect(f.root.getExposes().invalid.get()).toBe(false);
    await input(f, 'ab');
    expect(f.root.getExposes().getValidity().flags).toEqual(['tooShort']);
    await input(f, 'abcde');
    expect(f.root.getExposes().getValidity().flags).toEqual(['tooLong']);
    await input(f, '😀a');
    expect(f.root.getExposes().getValidity().flags).toEqual([]);
  });
  it('default validity initializes once, later default props do not overwrite results', async () => {
    const f = await mount(fixture({ defaultInvalid: true, defaultErrors: ['Initial error'] }));
    expect(f.root.getExposes().invalid.get()).toBe(true);
    expect(f.error.textContent).toBe('Initial error');
    f.root.getExposes().validate();
    await flush();
    expect(f.root.getExposes().invalid.get()).toBe(false);
    setElementProps(f.root, { defaultInvalid: true, defaultErrors: ['Later error'] });
    await flush();
    expect(f.root.getExposes().invalid.get()).toBe(false);
  });
  it('controlled validity emits the proposed result once and synchronous owner acceptance wins', async () => {
    const f = await mount(fixture({ required: true, invalid: false }));
    f.root.getExposes().validate();
    await flush();
    expect(f.results).toHaveLength(1);
    expect(f.results[0].invalid).toBe(true);
    expect(f.root.getExposes().invalid.get()).toBe(false);
    f.root.addEventListener('validityChange', (event: CustomEvent) =>
      setElementProps(f.root, {
        required: true,
        invalid: event.detail.invalid,
        errors: event.detail.errors,
      })
    );
    f.root.getExposes().validate();
    await flush();
    expect(f.root.getExposes().invalid.get()).toBe(true);
    expect(f.results).toHaveLength(2);
  });
  it('rejected malformed and mismatched completions leave a valid pending lease resolvable only once', async () => {
    const f = await mount(fixture({ externalValidation: true }));
    const root = f.root.getExposes(),
      id = root.validate();
    for (const result of [
      null,
      { invalid: 'yes' },
      { invalid: true, errors: [3] },
      { invalid: true, extra: true },
    ])
      expect(root.resolveValidation(id, result)).toBe(false);
    expect(root.pending.get()).toBe(true);
    expect(root.resolveValidation(id, { invalid: true, errors: ['Current error'] })).toBe(true);
    expect(root.resolveValidation(id, { invalid: false })).toBe(false);
  });
  it('IME editing invalidates old work but waits until compositionend before validating', async () => {
    const f = await mount(fixture({ externalValidation: true, validationMode: 'onChange' }));
    const root = f.root.getExposes(),
      id = root.validate(),
      e = editor(f);
    e.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true, data: '' })
    );
    e.value = '中';
    e.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, isComposing: true, data: '中' })
    );
    await flush();
    expect(root.resolveValidation(id, { invalid: false })).toBe(false);
    expect(f.requests).toHaveLength(1);
    e.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '中' })
    );
    await flush();
    expect(f.requests).toHaveLength(2);
    expect(f.requests.at(-1).value).toBe('中');
  });
  it('label pointer activation focuses the editor once, and activation=false leaves it alone', async () => {
    const f = await mount(fixture());
    pointerClick(f.label);
    await flush();
    expect(f.control.getExposes().focused.get()).toBe(true);
    editor(f).blur();
    setElementProps(f.label, { activation: false });
    await flush();
    pointerClick(f.label);
    await flush();
    expect(f.control.getExposes().focused.get()).toBe(false);
  });
  it('retained errors are hidden and unlink; remount keeps a current name and description', async () => {
    const f = fixture({ invalid: true, errors: ['Current'] });
    setElementProps(f.error, { keepMounted: true });
    await mount(f);
    const id = f.error.id;
    expect(editor(f).getAttribute('aria-errormessage')).toBe(id);
    setElementProps(f.root, { invalid: false });
    await flush();
    expect(f.error.getAttribute('aria-hidden')).toBe('true');
    expect(editor(f).hasAttribute('aria-errormessage')).toBe(false);
    f.description.remove();
    await flush();
    expect(editor(f).hasAttribute('aria-describedby')).toBe(false);
    f.root.append(f.description);
    await flush();
    expect(editor(f).getAttribute('aria-describedby')).toBe(f.description.id);
  });
});

describe('Field policy and interrupted replacement negative controls', () => {
  it('does not keep a stale success after required/length policy changes or call pending controlled state valid', async () => {
    const f = await mount(fixture());
    f.root.getExposes().validate();
    expect(f.root.getExposes().getValidity().status).toBe('valid');
    setElementProps(f.root, { required: true });
    await flush();
    expect(f.root.getExposes().getValidity().status).toBe('unvalidated');
    f.root.getExposes().validate();
    expect(f.root.getExposes().invalid.get()).toBe(true);
    setElementProps(f.root, { invalid: false, externalValidation: true });
    await flush();
    f.root.getExposes().validate();
    expect(f.root.getExposes().getValidity().status).toBe('unvalidated');
    expect(f.root.getExposes().pending.get()).toBe(true);
  });
  it('starting an IME composition without a changed value already retires a pending reply', async () => {
    const f = await mount(fixture({ externalValidation: true }, { defaultValue: 'same' }));
    const id = f.root.getExposes().validate();
    editor(f).dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true, data: '' })
    );
    await flush();
    expect(f.root.getExposes().resolveValidation(id, { invalid: true })).toBe(false);
    expect(f.root.getExposes().pending.get()).toBe(false);
  });
  it('cannot accept results during no-Control gaps even if owner invalid=false is explicit', async () => {
    const root = part('root', { invalid: false, externalValidation: true });
    document.body.append(root);
    await flush();
    expect(root.getExposes().getValidity().status).toBe('unvalidated');
    expect(root.getExposes().validate()).toBeNull();
    expect(root.getExposes().resolveValidation('foreign', { invalid: false })).toBe(false);
  });
});
