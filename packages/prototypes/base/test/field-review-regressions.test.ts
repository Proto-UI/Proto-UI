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
describe('Field reviewer policy transition regressions', () => {
  it('invalidates pending validation when Control readonly changes in either direction', async () => {
    const f = await mount(fixture({ externalValidation: true }, { defaultValue: 'same' }));
    const root = f.root.getExposes();
    const editableRequest = root.validate();
    setElementProps(f.control, { defaultValue: 'same', readOnly: true });
    await flush();
    expect(root.resolveValidation(editableRequest, { invalid: true })).toBe(false);
    const readonlyRequest = root.validate();
    expect(readonlyRequest).not.toBeNull();
    expect(root.pending.get()).toBe(true);
    setElementProps(f.control, { defaultValue: 'same', readOnly: false });
    await flush();
    expect(editor(f).readOnly).toBe(false);
    expect(root.resolveValidation(readonlyRequest, { invalid: true })).toBe(false);
    expect(root.pending.get()).toBe(false);
  });
  it('does not accept sparse arrays as finite Field values', async () => {
    const f = await mount(fixture());
    expect(f.control.getExposes().reportField({ value: ['a', 'b'] })).toBe(true);
    expect(f.control.getExposes().reportField({ value: Array(1) })).toBe(false);
  });
  it('rejects sparse validation errors without spending the pending request', async () => {
    const f = await mount(fixture({ externalValidation: true }));
    const root = f.root.getExposes(),
      id = root.validate();
    expect(root.resolveValidation(id, { invalid: true, errors: Array(1) })).toBe(false);
    expect(root.resolveValidation(id, { invalid: true, errors: ['Current error'] })).toBe(true);
  });
});

let genericSequence = 0;
async function genericFixture() {
  const root = part('root', { externalValidation: true });
  const proto = definePrototype({
    name: `field-review-generic-${++genericSequence}`,
    setup() {
      asFieldControl();
    },
  });
  AdaptToWebComponent(proto);
  const control = document.createElement(proto.name) as any;
  root.append(control);
  document.body.append(root);
  await flush();
  return { root: root.getExposes(), control: control.getExposes() };
}

describe('Field payload normalization precedes any retained mutation', () => {
  it('rejects sparse initialValue before first report and after initialization without poisoning the baseline', async () => {
    const f = await genericFixture();
    const before = f.root.getValidity();
    expect(f.control.reportField({ value: ['attempt'], initialValue: Array(1) })).toBe(false);
    expect(f.root.getValidity()).toEqual(before);
    expect(f.control.reportField({ value: ['stable'] })).toBe(true);
    expect(f.root.dirty.get()).toBe(false);
    const requestId = f.root.validate();
    expect(f.control.reportField({ value: ['changed'], initialValue: ['x', , 'y'] })).toBe(false);
    expect(f.root.dirty.get()).toBe(false);
    expect(f.root.pending.get()).toBe(true);
    expect(f.root.resolveValidation(requestId, { invalid: false })).toBe(true);
  });
  it.each([
    ['leading hole', [, 'tail']],
    ['middle hole', ['first', , 'last']],
    ['trailing hole', ['first', ,]],
    ['explicit undefined', [undefined]],
  ])('rejects %s errors without changing the original pending snapshot', async (_, errors) => {
    const f = await mount(fixture({ externalValidation: true }));
    const root = f.root.getExposes(),
      id = root.validate(),
      before = root.getValidity();
    expect(root.resolveValidation(id, { invalid: true, errors })).toBe(false);
    expect(root.getValidity()).toEqual(before);
    expect(root.resolveValidation(id, { invalid: false, errors })).toBe(false);
    expect(root.pending.get()).toBe(true);
    expect(root.resolveValidation(id, { invalid: true, errors: ['Current error'] })).toBe(true);
    expect(root.getValidity().errors).toEqual(['Current error']);
    expect(root.resolveValidation(id, { invalid: false })).toBe(false);
  });
  it('does not treat inherited array slots as finite own items', async () => {
    const values = Array(1);
    Object.setPrototypeOf(values, Object.create(Array.prototype, { 0: { value: 'inherited' } }));
    const f = await genericFixture();
    expect(f.control.reportField({ value: values })).toBe(false);
    expect(f.control.reportField({ value: ['owned'] })).toBe(true);
    const id = f.root.validate();
    expect(f.root.resolveValidation(id, { invalid: true, errors: values })).toBe(false);
    expect(f.root.resolveValidation(id, { invalid: false })).toBe(true);
  });
  it('preserves a throwing payload getter error and the same valid pending request', async () => {
    const f = await mount(fixture({ externalValidation: true }));
    const root = f.root.getExposes(),
      id = root.validate(),
      failure = new Error('payload read failed');
    let caught: unknown;
    try {
      root.resolveValidation(id, {
        invalid: true,
        get errors() {
          throw failure;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(root.pending.get()).toBe(true);
    expect(root.getValidity().errors).toEqual([]);
    expect(root.resolveValidation(id, { invalid: true, errors: ['Recovered'] })).toBe(true);
    expect(root.getValidity().errors).toEqual(['Recovered']);
  });
  it('normalizes each payload field/index once and never invokes an array iterator during commit', async () => {
    const f = await mount(fixture({ externalValidation: true }));
    const root = f.root.getExposes(),
      id = root.validate();
    let invalidReads = 0,
      errorsReads = 0,
      itemReads = 0;
    const errors = ['placeholder'];
    Object.defineProperty(errors, '0', {
      enumerable: true,
      get() {
        itemReads++;
        return itemReads === 1 ? 'Captured once' : undefined;
      },
    });
    Object.defineProperty(errors, Symbol.iterator, {
      value() {
        throw Error('caller iterator must not run');
      },
    });
    expect(
      root.resolveValidation(id, {
        get invalid() {
          invalidReads++;
          return invalidReads === 1;
        },
        get errors() {
          errorsReads++;
          return errors;
        },
      })
    ).toBe(true);
    expect([invalidReads, errorsReads, itemReads]).toEqual([1, 1, 1]);
    expect(root.getValidity().errors).toEqual(['Captured once']);
  });
  it('preserves report read errors and a newer reentrant canonical report', async () => {
    const f = await genericFixture();
    expect(f.control.reportField({ value: ['baseline'] })).toBe(true);
    const id = f.root.validate(),
      failure = new Error('value read failed');
    let caught: unknown;
    try {
      f.control.reportField({
        get value() {
          throw failure;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(f.root.dirty.get()).toBe(false);
    expect(f.root.resolveValidation(id, { invalid: false })).toBe(true);
    expect(
      f.control.reportField({
        get value() {
          f.control.reportField({ value: ['newer'] });
          return ['older'];
        },
      })
    ).toBe(false);
    expect(f.control.__fieldSnapshot().value).toEqual(['newer']);
  });
  it('does not consume a newer validation lease created while reading an older result', async () => {
    const f = await mount(fixture({ externalValidation: true }));
    const root = f.root.getExposes(),
      old = root.validate();
    let newer: string | null = null;
    expect(
      root.resolveValidation(old, {
        invalid: true,
        get errors() {
          newer = root.validate();
          return ['Outdated'];
        },
      })
    ).toBe(false);
    expect(newer).not.toBeNull();
    expect(root.pending.get()).toBe(true);
    expect(root.resolveValidation(newer, { invalid: false })).toBe(true);
    expect(root.getValidity().errors).toEqual([]);
  });
});

describe('Field change-only controlled editor ownership', () => {
  it.each(['reject', 'accept', 'replace'] as const)(
    'keeps physical editor and Field canonical value aligned when the owner chooses to %s',
    async (response) => {
      const f = await mount(fixture({ externalValidation: true }, { value: 'owner' }));
      const seen: string[] = [];
      f.control.addEventListener('change', (e: CustomEvent<{ value: string }>) => {
        seen.push(e.detail.value);
        if (response !== 'reject')
          setElementProps(f.control, {
            value: response === 'accept' ? e.detail.value : 'replacement',
          });
      });
      const target = editor(f);
      target.focus();
      target.value = 'candidate';
      target.setSelectionRange(3, 3);
      target.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      await flush();
      const expected =
        response === 'reject' ? 'owner' : response === 'accept' ? 'candidate' : 'replacement';
      expect(seen).toEqual(['candidate']);
      expect(target.value).toBe(expected);
      expect(f.control.getExposes().value.get()).toBe(expected);
      f.root.getExposes().validate();
      await flush();
      expect(f.requests.at(-1).value).toBe(expected);
      if (response === 'accept') {
        expect(target.selectionStart).toBe(3);
        expect(target.selectionEnd).toBe(3);
      }
    }
  );
});
