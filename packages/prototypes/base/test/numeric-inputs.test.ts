import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as slider from '../src/slider';
import * as number from '../src/number-field';
import * as otp from '../src/input-otp';
for (const group of [slider, number, otp])
  for (const p of Object.values(group))
    if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const part = (name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement('base-' + name) as any;
  setElementProps(el, props);
  return el;
};
const editor = (el: any) => el.shadowRoot?.querySelector('input') ?? el.querySelector('input');
const type = async (el: any, text: string) => {
  const e = editor(el);
  e.value = text;
  e.dispatchEvent(
    new InputEvent('input', { bubbles: true, composed: true, data: text, inputType: 'insertText' })
  );
  await flush();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it('Slider snaps finite values and restores canceled uncontrolled input; keyboard reaches bounds', async () => {
  const root = part('slider-root', { min: 0, max: 10, step: 0.5, defaultValue: 2 }),
    track = part('slider-track'),
    thumb = part('slider-thumb');
  track.append(thumb);
  root.append(track);
  document.body.append(root);
  await flush();
  expect(root.getExposes().requestValue(6.24)).toBe(true);
  expect(root.getExposes().value.get()).toBe(6);
  expect(root.getExposes().requestValue(NaN)).toBe(false);
  root.getExposes().beginInteraction();
  root.getExposes().requestValue(8);
  root.getExposes().cancelInteraction();
  expect(root.getExposes().value.get()).toBe(6);
  thumb.getExposes().focusSelf();
  await flush();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await flush();
  expect(root.getExposes().value.get()).toBe(10);
  setElementProps(root, { min: 0, max: 10, step: 0.5, disabled: true });
  await flush();
  expect(root.getExposes().requestValue(3)).toBe(false);
});
it('Slider controlled requests preserve canonical values', async () => {
  const root = part('slider-root', { value: 20 }),
    track = part('slider-track'),
    thumb = part('slider-thumb');
  track.append(thumb);
  root.append(track);
  let proposed = 0;
  root.addEventListener('valueChange', (e: CustomEvent) => (proposed = e.detail.value));
  document.body.append(root);
  await flush();
  root.getExposes().requestValue(40);
  expect(proposed).toBe(40);
  expect(root.getExposes().value.get()).toBe(20);
});
it('Number Field edits drafts in one host input, rounds steps and suppresses disabled step buttons', async () => {
  const root = part('number-field-root', { min: 0, max: 10, step: 0.5, defaultValue: 2 }),
    input = part('number-field-input'),
    plus = part('number-field-increment'),
    minus = part('number-field-decrement');
  root.append(minus, input, plus);
  document.body.append(root);
  await flush();
  expect(editor(input).value).toBe('2');
  await type(input, '3.7');
  expect(root.getExposes().value.get()).toBe(3.5);
  root.getExposes().commitValue();
  await flush();
  expect(editor(input).value).toBe('3.5');
  await type(input, '-');
  root.getExposes().commitValue();
  await flush();
  expect(editor(input).value).toBe('3.5');
  root.getExposes().stepBy(100);
  await flush();
  expect(root.getExposes().value.get()).toBe(10);
  expect(plus.getExposes().disabled.get()).toBe(true);
  setElementProps(root, { readOnly: true });
  await flush();
  await type(input, '8');
  expect(root.getExposes().value.get()).toBe(10);
  expect(editor(input).readOnly).toBe(true);
});
it('OTP filters paste-like input, bounds slots, preserves one editor and emits accepted completion once', async () => {
  const root = part('input-otp-root', { length: 4 }),
    input = part('input-otp-input'),
    slots = [0, 1, 2, 3].map((index) => part('input-otp-slot', { index }));
  root.append(input, ...slots);
  const completed: any[] = [];
  root.addEventListener('completed', (e: CustomEvent) => completed.push(e.detail));
  document.body.append(root);
  await flush();
  await type(input, '12a 345');
  expect(root.getExposes().value.get()).toBe('1234');
  expect(editor(input).value).toBe('1234');
  expect(slots.map((s) => s.textContent).join('')).toBe('1234');
  expect(completed).toEqual([{ value: '1234' }]);
  expect(editor(input).autocomplete).toBe('one-time-code');
  expect(
    input.shadowRoot?.querySelectorAll('input').length ?? input.querySelectorAll('input').length
  ).toBe(1);
  root.getExposes().requestValue('1234');
  expect(completed).toHaveLength(1);
  root.getExposes().clear();
  await flush();
  expect(root.getExposes().complete.get()).toBe(false);
  expect(slots[0].textContent).toBe('');
});
it('OTP controlled and disabled modes do not optimistically replace owner code', async () => {
  const root = part('input-otp-root', { value: '12', length: 4 }),
    input = part('input-otp-input');
  root.append(input);
  let proposal = '';
  root.addEventListener('valueChange', (e: CustomEvent) => (proposal = e.detail.value));
  document.body.append(root);
  await flush();
  await type(input, '1234');
  expect(proposal).toBe('1234');
  expect(root.getExposes().value.get()).toBe('12');
  expect(editor(input).value).toBe('12');
  setElementProps(root, { value: '12', length: 4, disabled: true });
  await flush();
  expect(root.getExposes().clear()).toBe(false);
  expect(editor(input).disabled).toBe(true);
});
it('Slider routes real Web pointer samples through normalized AxisInput and cancels a disabled drag', async () => {
  const root = part('slider-root', { defaultValue: 10 }),
    track = part('slider-track'),
    thumb = part('slider-thumb');
  track.append(thumb);
  root.append(track);
  document.body.append(root);
  await flush();
  track.getBoundingClientRect = () => ({ left: 10, top: 0, width: 200, height: 100 }) as DOMRect;
  const pointer = (type: string, x: number) =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 3,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: x,
    });
  thumb.dispatchEvent(pointer('pointerdown', 60));
  track.dispatchEvent(pointer('pointermove', 110));
  track.dispatchEvent(pointer('pointerup', 160));
  await flush();
  expect(root.getExposes().value.get()).toBe(75);
  expect(root.getExposes().dragging.get()).toBe(false);
  thumb.dispatchEvent(pointer('pointerdown', 60));
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  track.dispatchEvent(pointer('pointerup', 210));
  expect(root.getExposes().value.get()).toBe(75);
  expect(root.getExposes().dragging.get()).toBe(false);
});
