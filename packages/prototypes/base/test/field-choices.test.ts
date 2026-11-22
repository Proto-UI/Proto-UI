import { afterEach, describe, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  getElementProps,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import * as baseField from '../src/field';
import * as shadcnField from '../../shadcn/src/field';
import * as brutalistField from '../../brutalist/src/field';
import * as baseForm from '../src/form';
import * as shadcnForm from '../../shadcn/src/form';
import * as brutalistForm from '../../brutalist/src/form';
import * as baseCheckbox from '../src/checkbox';
import * as shadcnCheckbox from '../../shadcn/src/checkbox';
import * as brutalistCheckbox from '../../brutalist/src/checkbox';
import * as baseRadio from '../src/radio-group';
import * as shadcnRadio from '../../shadcn/src/radio-group';
import * as brutalistRadio from '../../brutalist/src/radio-group';
import * as baseSwitch from '../src/switch';
import * as shadcnSwitch from '../../shadcn/src/switch';
import * as brutalistSwitch from '../../brutalist/src/switch';
const libraries = {
  base: {
    field: baseField,
    form: baseForm,
    checkbox: baseCheckbox,
    radio: baseRadio,
    switch: baseSwitch,
  },
  shadcn: {
    field: shadcnField,
    form: shadcnForm,
    checkbox: shadcnCheckbox,
    radio: {
      ...shadcnRadio,
      radioGroupRoot: shadcnRadio.shadcnRadioGroupRoot,
      radioGroupItem: shadcnRadio.shadcnRadioGroupItem,
    },
    switch: shadcnSwitch,
  },
  brutalist: {
    field: brutalistField,
    form: brutalistForm,
    checkbox: {
      ...brutalistCheckbox,
      checkboxRoot: brutalistCheckbox.brutalistCheckboxRoot,
      checkboxIndicator: brutalistCheckbox.brutalistCheckboxIndicator,
    },
    radio: {
      ...brutalistRadio,
      radioGroupRoot: brutalistRadio.brutalistRadioGroupRoot,
      radioGroupItem: brutalistRadio.brutalistRadioGroupItem,
    },
    switch: brutalistSwitch,
  },
};
for (const library of Object.values(libraries))
  for (const module of Object.values(library))
    for (const proto of Object.values(module))
      if (proto && typeof proto === 'object' && 'setup' in proto) AdaptToWebComponent(proto as any);
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let n = 0; n < 30; n++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const pointerClick = (node: HTMLElement) => {
  for (const type of ['pointerdown', 'pointerup'])
    node.dispatchEvent(
      new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, button: 0 })
    );
  node.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
};
const patch = (node: HTMLElement, props: Record<string, unknown>) =>
  setElementProps(node, { ...getElementProps(node), ...props });
function mount(
  family: keyof typeof libraries,
  kind: 'checkbox' | 'radio' | 'switch',
  props: Record<string, unknown> = {},
  fieldProps: Record<string, unknown> = {}
) {
  const lib = libraries[family];
  const make = (proto: { name: string }, props: Record<string, unknown> = {}) => {
    const node = document.createElement(proto.name) as any;
    setElementProps(node, props);
    return node;
  };
  const form = make(lib.form.formRoot);
  const field = make(lib.form.formField, { name: 'choice', ...fieldProps });
  const label = make(lib.field.fieldLabel);
  label.textContent = 'Choice';
  const help = make(lib.field.fieldDescription);
  help.textContent = 'Public selection';
  const error = make(lib.field.fieldError);
  const control = make(
    kind === 'checkbox'
      ? lib.field.fieldCheckbox
      : kind === 'radio'
        ? lib.field.fieldRadioGroup
        : lib.field.fieldSwitch,
    props
  );
  const items =
    kind === 'radio'
      ? ['a', 'b', 'c'].map((value) =>
          make(lib.radio.radioGroupItem, { value, disabled: value === 'c' })
        )
      : [];
  if (kind === 'checkbox') control.append(make(lib.checkbox.checkboxIndicator));
  if (kind === 'switch') control.append(make(lib.switch.switchThumb));
  for (const item of items) {
    item.textContent = getElementProps(item).value as string;
    control.append(item);
  }
  field.append(label, help, control, error);
  form.append(field);
  document.body.append(form);
  const outside = document.createElement('button');
  document.body.append(outside);
  return {
    form,
    field,
    control,
    label,
    help,
    error,
    items,
    outside,
    values: () => form.getExposes().getValues(),
    x: () => control.getExposes(),
    validity: () => field.getExposes().getValidity(),
  };
}
for (const family of Object.keys(libraries) as Array<keyof typeof libraries>)
  describe(`${family} explicit choice Fields`, () => {
    it('keeps mixed display separate from the canonical boolean required oracle', async () => {
      const f = mount(
        family,
        'checkbox',
        { defaultChecked: false, defaultIndeterminate: true },
        { required: true, validationMode: 'onChange' }
      );
      await flush();
      expect(f.values()).toEqual({ choice: false });
      expect(f.control.getAttribute('aria-checked')).toBe('mixed');
      f.field.getExposes().validate();
      await flush();
      expect(f.validity().invalid).toBe(true);
      expect(f.control.getAttribute('aria-labelledby')).toBe(f.label.id);
      expect(f.control.getAttribute('aria-describedby')).toBe(f.help.id);
      expect(f.control.getAttribute('aria-errormessage')).toBe(f.error.id);
      f.control.click();
      await flush();
      expect(f.values()).toEqual({ choice: true });
      expect(f.x().indeterminate.get()).toBe(false);
      expect(f.validity().invalid).toBe(false);
      expect(f.field.getExposes().dirty.get()).toBe(true);
      patch(f.control, { defaultChecked: true, defaultIndeterminate: false });
      f.form.getExposes().requestReset();
      await flush();
      expect(f.values()).toEqual({ choice: false });
      expect(f.control.getAttribute('aria-checked')).toBe('mixed');
      expect(f.field.getExposes().dirty.get()).toBe(false);
    });
    it.each(['checkbox', 'radio'] as const)(
      '%s only notifies accepted canonical changes and retains refused reset dirty',
      async (kind) => {
        const f = mount(family, kind, kind === 'checkbox' ? { checked: false } : { value: 'a' }, {
          validationMode: 'onChange',
          externalValidation: true,
        });
        await flush();
        let accepts = false;
        const changes: any[] = [],
          requests: any[] = [];
        const key = kind === 'checkbox' ? 'checked' : 'value';
        f.control.addEventListener(
          kind === 'checkbox' ? 'checkedChange' : 'valueChange',
          (event: CustomEvent) => {
            changes.push(event.detail);
            if (accepts) queueMicrotask(() => patch(f.control, { [key]: event.detail[key] }));
          }
        );
        f.field.addEventListener('validationRequest', (event: CustomEvent) =>
          requests.push(event.detail)
        );
        const act = () => (kind === 'checkbox' ? f.control.click() : f.x().requestValue('b'));
        act();
        await flush();
        expect(f.values()).toEqual({ choice: kind === 'checkbox' ? false : 'a' });
        expect(f.field.getExposes().dirty.get()).toBe(false);
        expect(changes).toHaveLength(1);
        expect(requests).toEqual([]);
        accepts = true;
        act();
        await flush();
        expect(f.values()).toEqual({ choice: kind === 'checkbox' ? true : 'b' });
        expect(requests).toHaveLength(1);
        expect(requests[0].value).toBe(kind === 'checkbox' ? true : 'b');
        expect(f.field.getExposes().dirty.get()).toBe(true);
        accepts = false;
        requests.length = 0;
        f.form.getExposes().requestReset();
        await flush();
        expect(f.values()).toEqual({ choice: kind === 'checkbox' ? true : 'b' });
        expect(f.field.getExposes().dirty.get()).toBe(true);
        expect(requests).toEqual([]);
        accepts = true;
        f.form.getExposes().requestReset();
        await flush();
        expect(f.values()).toEqual({ choice: kind === 'checkbox' ? false : 'a' });
        expect(f.field.getExposes().dirty.get()).toBe(false);
        expect(requests).toEqual([]);
      }
    );
    it.each(['checkbox', 'switch'] as const)(
      '%s readonly retains focus and omits disabled values',
      async (kind) => {
        const f = mount(family, kind, { defaultChecked: false }, { readOnly: true });
        await flush();
        const proposals: any[] = [];
        f.control.addEventListener('checkedChange', (event: CustomEvent) =>
          proposals.push(event.detail)
        );
        pointerClick(f.label);
        await flush();
        expect(document.activeElement).toBe(f.control);
        f.control.click();
        f.control.dispatchEvent(
          new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true })
        );
        f.control.dispatchEvent(
          new KeyboardEvent('keyup', { key: ' ', bubbles: true, composed: true })
        );
        await flush();
        expect(f.values()).toEqual({ choice: false });
        expect(proposals).toEqual([]);
        patch(f.field, { disabled: true });
        await flush();
        expect(f.values()).toEqual({});
        expect(f.control.getAttribute('aria-disabled')).toBe('true');
        patch(f.field, { disabled: false, readOnly: false });
        await flush();
        f.control.click();
        await flush();
        expect(f.values()).toEqual({ choice: true });
      }
    );
    it.each([false, true])(
      'Switch controlled=%s reset preserves initial canonical ownership while readonly',
      async (controlled) => {
        const f = mount(
          family,
          'switch',
          controlled ? { checked: false } : { defaultChecked: false },
          { validationMode: 'onChange', externalValidation: true }
        );
        await flush();
        let accepts = true;
        const changes: boolean[] = [],
          requests: unknown[] = [];
        f.control.addEventListener('checkedChange', (event: CustomEvent<{ checked: boolean }>) => {
          changes.push(event.detail.checked);
          if (controlled && accepts)
            queueMicrotask(() => patch(f.control, { checked: event.detail.checked }));
        });
        f.field.addEventListener('validationRequest', (event: CustomEvent) =>
          requests.push(event.detail)
        );
        f.control.click();
        await flush();
        expect(f.values()).toEqual({ choice: true });
        patch(f.control, { defaultChecked: true });
        patch(f.field, { readOnly: true });
        await flush();
        requests.length = 0;
        changes.length = 0;
        accepts = false;
        f.form.getExposes().requestReset();
        await flush();
        expect(f.values()).toEqual({ choice: controlled });
        expect(f.field.getExposes().dirty.get()).toBe(controlled);
        expect(changes).toEqual(controlled ? [false] : []);
        expect(requests).toEqual([]);
        accepts = true;
        f.form.getExposes().requestReset();
        await flush();
        expect(f.values()).toEqual({ choice: false });
        expect(f.field.getExposes().dirty.get()).toBe(false);
        expect(f.x().percentage.get()).toBe(0);
        expect(requests).toEqual([]);
      }
    );
    it('keeps radio roving under readonly and only treats departure from the group as blur', async () => {
      const f = mount(
        family,
        'radio',
        { defaultValue: 'a' },
        { readOnly: true, validationMode: 'onBlur', externalValidation: true }
      );
      await flush();
      const proposals: any[] = [],
        requests: any[] = [];
      f.control.addEventListener('valueChange', (event: CustomEvent) =>
        proposals.push(event.detail)
      );
      f.field.addEventListener('validationRequest', (event: CustomEvent) =>
        requests.push(event.detail)
      );
      pointerClick(f.label);
      await flush();
      expect(document.activeElement).toBe(f.items[0]);
      expect(f.x().focused.get()).toBe(true);
      f.items[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
      await flush();
      expect(document.activeElement).toBe(f.items[1]);
      expect(f.values()).toEqual({ choice: 'a' });
      expect(proposals).toEqual([]);
      expect(f.field.getExposes().touched.get()).toBe(false);
      expect(requests).toEqual([]);
      f.items[1].click();
      await flush();
      expect(proposals).toEqual([]);
      f.outside.focus();
      await flush();
      expect(f.x().focused.get()).toBe(false);
      expect(f.field.getExposes().touched.get()).toBe(true);
      expect(requests).toHaveLength(1);
      expect(requests[0].value).toBe('a');
    });
    it.each(['reset', 'readOnly', 'disabled'] as const)(
      'Radio retires a pending blur on %s and can observe a later departure',
      async (boundary) => {
        const f = mount(
          family,
          'radio',
          { defaultValue: 'a' },
          { validationMode: 'onBlur', externalValidation: true }
        );
        await flush();
        const requests: unknown[] = [];
        f.field.addEventListener('validationRequest', (event: CustomEvent) =>
          requests.push(event.detail)
        );
        f.items[0].focus();
        await flush();
        expect(f.x().focused.get()).toBe(true);
        f.outside.focus();
        if (boundary === 'reset') f.form.getExposes().requestReset();
        else patch(f.field, { [boundary]: true });
        expect(f.field.getExposes().touched.get()).toBe(false);
        await flush();
        expect(f.field.getExposes().touched.get()).toBe(false);
        expect(f.x().focused.get()).toBe(false);
        expect(requests).toEqual([]);
        if (boundary !== 'reset') patch(f.field, { [boundary]: false });
        await flush();
        f.items[0].focus();
        await flush();
        f.outside.focus();
        await flush();
        expect(f.field.getExposes().touched.get()).toBe(true);
        expect(requests).toHaveLength(1);
      }
    );
    it('does not make ordinary Checkbox or Radio Group a Form field', async () => {
      const lib = libraries[family];
      const form = document.createElement(lib.form.formRoot.name) as any;
      const checkbox = document.createElement(lib.checkbox.checkboxRoot.name) as any;
      const radio = document.createElement(lib.radio.radioGroupRoot.name) as any;
      const item = document.createElement(lib.radio.radioGroupItem.name);
      setElementProps(item, { value: 'a' });
      radio.append(item);
      form.append(checkbox, radio);
      document.body.append(form);
      await flush();
      expect(form.getExposes().getValues()).toEqual({});
      expect(checkbox.getExposes().__fieldSnapshot).toBeUndefined();
      expect(radio.getExposes().__fieldSnapshot).toBeUndefined();
    });
  });
