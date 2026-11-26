import { afterEach, describe, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  getElementProps,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import * as baseField from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/field';
import * as shadcnField from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/shadcn/src/field';
import * as brutalistField from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/brutalist/src/field';
import * as baseForm from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/form';
import * as shadcnForm from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/shadcn/src/form';
import * as brutalistForm from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/brutalist/src/form';
import * as baseCheckbox from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/checkbox';
import * as shadcnCheckbox from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/shadcn/src/checkbox';
import * as brutalistCheckbox from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/brutalist/src/checkbox';
import * as baseRadio from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/radio-group';
import * as shadcnRadio from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/shadcn/src/radio-group';
import * as brutalistRadio from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/brutalist/src/radio-group';
import * as baseSwitch from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/switch';
import * as shadcnSwitch from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/shadcn/src/switch';
import * as brutalistSwitch from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/brutalist/src/switch';
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

for(const family of ['base','shadcn','brutalist'] as const) {
 it(`${family} reset retires the queued prior radio departure`,async()=>{
   const f=mount(family,'radio',{defaultValue:'a'},{validationMode:'onBlur',externalValidation:true});
   await flush();const validations:any[]=[];
   f.field.addEventListener('validationRequest',(event:CustomEvent)=>validations.push(event.detail));
   f.items[0].focus();await flush();
   expect(f.x().focused.get()).toBe(true);
   expect(f.field.getExposes().touched.get()).toBe(false);
   f.outside.focus();
   f.form.getExposes().requestReset();
   expect(f.field.getExposes().touched.get()).toBe(false);
   await flush();
   expect(f.field.getExposes().touched.get()).toBe(false);
   expect(validations).toEqual([]);
   expect(f.values()).toEqual({choice:'a'});
 });
 it(`${family} initial true checkbox baseline is already clean`,async()=>{
   const f=mount(family,'checkbox',{checked:true,indeterminate:true},{validationMode:'onChange',externalValidation:true});await flush();
   expect(f.values()).toEqual({choice:true});expect(f.field.getExposes().dirty.get()).toBe(false);
   patch(f.control,{checked:false,indeterminate:false});await flush();expect(f.field.getExposes().dirty.get()).toBe(true);
   f.form.getExposes().requestReset();await flush();expect(f.values()).toEqual({choice:false});expect(f.field.getExposes().dirty.get()).toBe(true);
 });
}
