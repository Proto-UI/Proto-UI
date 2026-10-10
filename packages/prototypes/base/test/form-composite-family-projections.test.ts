import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as f0form from '../../shadcn/src/form';
import * as f0field from '../../shadcn/src/field';
import * as f0numberfield from '../../shadcn/src/number-field';
import * as f0inputotp from '../../shadcn/src/input-otp';
import * as f0slider from '../../shadcn/src/slider';
import * as f1form from '../../brutalist/src/form';
import * as f1field from '../../brutalist/src/field';
import * as f1numberfield from '../../brutalist/src/number-field';
import * as f1inputotp from '../../brutalist/src/input-otp';
import * as f1slider from '../../brutalist/src/slider';
import * as f2form from '../../bootstrap-2-3-2/src/form';
import * as f2field from '../../bootstrap-2-3-2/src/field';
import * as f2numberfield from '../../bootstrap-2-3-2/src/number-field';
import * as f2inputotp from '../../bootstrap-2-3-2/src/input-otp';
import * as f2slider from '../../bootstrap-2-3-2/src/slider';
import * as f3form from '../../liquid-glass/src/form';
import * as f3field from '../../liquid-glass/src/field';
import * as f3numberfield from '../../liquid-glass/src/number-field';
import * as f3inputotp from '../../liquid-glass/src/input-otp';
import * as f3slider from '../../liquid-glass/src/slider';
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const group of [f0form, f0field, f0numberfield, f0inputotp, f0slider])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('shadcn projects composed Field controls and real reset', async () => {
  const p = (name: string, props: Record<string, unknown> = {}) => {
    const el = document.createElement('shadcn-' + name) as any;
    setElementProps(el, props);
    return el;
  };
  const form = p('form-root'),
    reset = p('form-reset');
  const number = p('number-field-root', { defaultValue: 2 }),
    input = p('number-field-control');
  number.append(input);
  const otp = p('input-otp-root', { defaultValue: '12' }),
    otpInput = p('input-otp-control');
  otp.append(otpInput);
  const slider = p('slider-root', { defaultValue: 20 }),
    track = p('slider-track'),
    thumb = p('slider-field-thumb');
  track.append(thumb);
  slider.append(track);
  for (const [name, root] of [
    ['number', number],
    ['otp', otp],
    ['slider', slider],
  ] as const) {
    const field = p('form-field', { name }),
      label = p('field-label');
    label.textContent = name;
    field.append(label, root);
    form.append(field);
  }
  form.append(reset);
  document.body.append(form);
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  number.getExposes().requestValue(6);
  slider.getExposes().requestValue(70);
  await flush();
  reset.click();
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  expect(editor.value).toBe('2');
  expect(editor.getAttribute('aria-labelledby')).toBeTruthy();
});
for (const group of [f1form, f1field, f1numberfield, f1inputotp, f1slider])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('brutalist projects composed Field controls and real reset', async () => {
  const p = (name: string, props: Record<string, unknown> = {}) => {
    const el = document.createElement('brutalist-' + name) as any;
    setElementProps(el, props);
    return el;
  };
  const form = p('form-root'),
    reset = p('form-reset');
  const number = p('number-field-root', { defaultValue: 2 }),
    input = p('number-field-control');
  number.append(input);
  const otp = p('input-otp-root', { defaultValue: '12' }),
    otpInput = p('input-otp-control');
  otp.append(otpInput);
  const slider = p('slider-root', { defaultValue: 20 }),
    track = p('slider-track'),
    thumb = p('slider-field-thumb');
  track.append(thumb);
  slider.append(track);
  for (const [name, root] of [
    ['number', number],
    ['otp', otp],
    ['slider', slider],
  ] as const) {
    const field = p('form-field', { name }),
      label = p('field-label');
    label.textContent = name;
    field.append(label, root);
    form.append(field);
  }
  form.append(reset);
  document.body.append(form);
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  number.getExposes().requestValue(6);
  slider.getExposes().requestValue(70);
  await flush();
  reset.click();
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  expect(editor.value).toBe('2');
  expect(editor.getAttribute('aria-labelledby')).toBeTruthy();
});
for (const group of [f2form, f2field, f2numberfield, f2inputotp, f2slider])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('bootstrap-2-3-2 projects composed Field controls and real reset', async () => {
  const p = (name: string, props: Record<string, unknown> = {}) => {
    const el = document.createElement('bootstrap-2-3-2-' + name) as any;
    setElementProps(el, props);
    return el;
  };
  const form = p('form-root'),
    reset = p('form-reset');
  const number = p('number-field-root', { defaultValue: 2 }),
    input = p('number-field-control');
  number.append(input);
  const otp = p('input-otp-root', { defaultValue: '12' }),
    otpInput = p('input-otp-control');
  otp.append(otpInput);
  const slider = p('slider-root', { defaultValue: 20 }),
    track = p('slider-track'),
    thumb = p('slider-field-thumb');
  track.append(thumb);
  slider.append(track);
  for (const [name, root] of [
    ['number', number],
    ['otp', otp],
    ['slider', slider],
  ] as const) {
    const field = p('form-field', { name }),
      label = p('field-label');
    label.textContent = name;
    field.append(label, root);
    form.append(field);
  }
  form.append(reset);
  document.body.append(form);
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  number.getExposes().requestValue(6);
  slider.getExposes().requestValue(70);
  await flush();
  reset.click();
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  expect(editor.value).toBe('2');
  expect(editor.getAttribute('aria-labelledby')).toBeTruthy();
});
for (const group of [f3form, f3field, f3numberfield, f3inputotp, f3slider])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('liquid-glass projects composed Field controls and real reset', async () => {
  const p = (name: string, props: Record<string, unknown> = {}) => {
    const el = document.createElement('liquid-glass-' + name) as any;
    setElementProps(el, props);
    return el;
  };
  const form = p('form-root'),
    reset = p('form-reset');
  const number = p('number-field-root', { defaultValue: 2 }),
    input = p('number-field-control');
  number.append(input);
  const otp = p('input-otp-root', { defaultValue: '12' }),
    otpInput = p('input-otp-control');
  otp.append(otpInput);
  const slider = p('slider-root', { defaultValue: 20 }),
    track = p('slider-track'),
    thumb = p('slider-field-thumb');
  track.append(thumb);
  slider.append(track);
  for (const [name, root] of [
    ['number', number],
    ['otp', otp],
    ['slider', slider],
  ] as const) {
    const field = p('form-field', { name }),
      label = p('field-label');
    label.textContent = name;
    field.append(label, root);
    form.append(field);
  }
  form.append(reset);
  document.body.append(form);
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  number.getExposes().requestValue(6);
  slider.getExposes().requestValue(70);
  await flush();
  reset.click();
  await flush();
  expect(form.getExposes().getValues()).toEqual({ number: 2, otp: '12', slider: 20 });
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  expect(editor.value).toBe('2');
  expect(editor.getAttribute('aria-labelledby')).toBeTruthy();
});
