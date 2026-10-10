import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldRoot } from '../src/field';
import * as baseSlider from '../src/slider';
import * as baseNumber from '../src/number-field';
import * as baseOtp from '../src/input-otp';
import * as shadcnSlider from '../../shadcn/src/slider';
import * as shadcnNumber from '../../shadcn/src/number-field';
import * as shadcnOtp from '../../shadcn/src/input-otp';
import * as neoSlider from '../../brutalist/src/slider';
import * as neoNumber from '../../brutalist/src/number-field';
import * as neoOtp from '../../brutalist/src/input-otp';
import * as bootstrapSlider from '../../bootstrap-2-3-2/src/slider';
import * as bootstrapNumber from '../../bootstrap-2-3-2/src/number-field';
import * as bootstrapOtp from '../../bootstrap-2-3-2/src/input-otp';
import * as liquidSlider from '../../liquid-glass/src/slider';
import * as liquidNumber from '../../liquid-glass/src/number-field';
import * as liquidOtp from '../../liquid-glass/src/input-otp';
AdaptToWebComponent(fieldRoot);
for (const group of [
  baseSlider,
  baseNumber,
  baseOtp,
  shadcnSlider,
  shadcnNumber,
  shadcnOtp,
  neoSlider,
  neoNumber,
  neoOtp,
  bootstrapSlider,
  bootstrapNumber,
  bootstrapOtp,
  liquidSlider,
  liquidNumber,
  liquidOtp,
])
  for (const p of Object.values(group))
    if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const part = (
  family: string,
  component: string,
  atom: string,
  props: Record<string, unknown> = {}
) => {
  const e = document.createElement(`${family}-${component}-${atom}`) as any;
  setElementProps(e, props);
  return e;
};
function binding(e: any) {
  const x = e.getExposes();
  for (const key of ['fieldDisabled', 'fieldReadOnly', 'fieldRequired', 'invalid', 'pending'])
    expect(typeof x[key].get(), key).toBe('boolean');
  expect(x.fieldRequired.get()).toBe(true);
}
async function bound(root: HTMLElement) {
  const field = document.createElement(fieldRoot.name);
  setElementProps(field, { required: true });
  field.append(root);
  document.body.append(field);
  await flush();
  return field;
}
for (const family of ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
  it(`${family} Slider six part public readouts and thumb commands exist on actual compositions`, async () => {
    const root = part(family, 'slider', 'root', { value: 25 });
    const track = part(family, 'slider', 'track'),
      indicator = part(family, 'slider', 'indicator'),
      thumb = part(family, 'slider', 'thumb'),
      label = part(family, 'slider', 'label'),
      value = part(family, 'slider', 'value');
    track.append(indicator, thumb);
    root.append(label, track, value);
    document.body.append(root);
    await flush();
    for (const e of [track, indicator, thumb, label, value]) {
      const x = e.getExposes();
      expect(x.value.get()).toBe(25);
      expect(x.percentage.get()).toBe(25);
      expect(x.direction.get()).toBe('ltr');
      expect(x.orientation.get()).toBe('horizontal');
      expect(typeof x.disabled.get()).toBe('boolean');
      expect(typeof x.readOnly.get()).toBe('boolean');
    }
    expect(typeof thumb.getExposes().focusSelf).toBe('function');
    expect(typeof thumb.getExposes().resetValue()).toBe('boolean');
    expect(track.getExposes()).not.toHaveProperty('focusSelf');
    const fieldSlider = part(family, 'slider', 'root', { value: 40 }),
      fieldThumb = part(family, 'slider', 'field-thumb');
    fieldSlider.append(fieldThumb);
    await bound(fieldSlider);
    binding(fieldThumb);
    expect(fieldThumb.getExposes().value.get()).toBe(40);
    expect(typeof fieldThumb.getExposes().focusVisible.get()).toBe('boolean');
  });
  it(`${family} NumberField editor, bound control, buttons and passive label match public capabilities`, async () => {
    const root = part(family, 'number-field', 'root', { value: 3 }),
      input = part(family, 'number-field', 'input'),
      plus = part(family, 'number-field', 'increment'),
      minus = part(family, 'number-field', 'decrement'),
      label = part(family, 'number-field', 'label');
    root.append(label, minus, input, plus);
    document.body.append(root);
    await flush();
    expect(input.getExposes().value.get()).toBe(3);
    expect(typeof input.getExposes().focused.get()).toBe('boolean');
    expect(typeof input.getExposes().resetValue()).toBe('boolean');
    for (const e of [plus, minus]) {
      expect(typeof e.getExposes().disabled.get()).toBe('boolean');
      expect(typeof e.getExposes().focusVisible.get()).toBe('boolean');
      expect(e.getExposes()).not.toHaveProperty('focusSelf');
    }
    expect(Object.keys(label.getExposes())).toEqual([]);
    const fieldNumber = part(family, 'number-field', 'root', { value: 4 }),
      control = part(family, 'number-field', 'control');
    fieldNumber.append(control);
    await bound(fieldNumber);
    binding(control);
    expect(control.getExposes().value.get()).toBe(4);
  });
  it(`${family} OTP input, bound control, slot and separator expose their actual distinct roles`, async () => {
    const root = part(family, 'input-otp', 'root', { value: '7' }),
      input = part(family, 'input-otp', 'input'),
      slot = part(family, 'input-otp', 'slot', { index: 0 }),
      separator = part(family, 'input-otp', 'separator');
    root.append(input, slot, separator);
    document.body.append(root);
    await flush();
    expect(typeof input.getExposes().disabled.get()).toBe('boolean');
    expect(typeof input.getExposes().focusVisible.get()).toBe('boolean');
    expect(typeof input.getExposes().resetValue()).toBe('boolean');
    expect(input.getExposes()).not.toHaveProperty('value');
    expect(slot.getExposes().character.get()).toBe('7');
    expect(slot.getExposes().filled.get()).toBe(true);
    expect(typeof slot.getExposes().active.get()).toBe('boolean');
    expect(slot.getExposes()).not.toHaveProperty('focusSelf');
    expect(Object.keys(separator.getExposes())).toEqual([]);
    const fieldOtp = part(family, 'input-otp', 'root', { value: '8' }),
      control = part(family, 'input-otp', 'control');
    fieldOtp.append(control);
    await bound(fieldOtp);
    binding(control);
  });
}

import { definePrototype } from '@proto.ui/core';
const bindingCaptures: Record<
  string,
  | ReturnType<typeof baseSlider.asSliderFieldThumb>
  | ReturnType<typeof baseNumber.asNumberFieldControl>
  | ReturnType<typeof baseOtp.asInputOtpControl>
> = {};
for (const [key, hook] of [
  ['slider', baseSlider.asSliderFieldThumb],
  ['number-field', baseNumber.asNumberFieldControl],
  ['input-otp', baseOtp.asInputOtpControl],
] as const) {
  AdaptToWebComponent(
    definePrototype({
      name: `test-${key}-public-binding`,
      modules: hook.modules,
      setup() {
        const handle = hook();
        bindingCaptures[key] = handle;
        return handle.render;
      },
    })
  );
}
it('three bound numeric controls preserve typed public child handles instead of flattening validity', async () => {
  for (const component of ['slider', 'number-field', 'input-otp']) {
    const root = part('base', component, 'root');
    root.append(document.createElement(`test-${component}-public-binding`));
    await bound(root);
    const handle = bindingCaptures[component];
    const child = handle.getAsHookHandle?.('as-field-control');
    expect(child).toBeDefined();
    expect(child!.state.fieldRequired.get()).toBe(true);
    expect(child!.state.invalid.get()).toBe(false);
    expect(handle.stateHandles).not.toHaveProperty('invalid');
    expect(handle.stateHandles).not.toHaveProperty('pending');
  }
});
