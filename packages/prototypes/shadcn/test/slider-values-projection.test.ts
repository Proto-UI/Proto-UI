import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  sliderValuesRoot,
  sliderValuesTrack,
  sliderValuesThumb,
  sliderValuesIndicator,
  sliderValuesLabel,
  sliderValuesValue,
} from '../src/slider';
import { styleContains } from '../../test-utils/style';

type Host = HTMLElement & { getExposes(): Record<string, any> };
for (const prototype of [
  sliderValuesRoot,
  sliderValuesTrack,
  sliderValuesThumb,
  sliderValuesIndicator,
  sliderValuesLabel,
  sliderValuesValue,
])
  AdaptToWebComponent(prototype);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const part = (name: string, props: Record<string, unknown> = {}) => {
  const element = document.createElement(name) as Host;
  setElementProps(element, props);
  return element;
};
async function fixture(
  props: Record<string, unknown> = {},
  indices: (number | undefined)[] = [0, 1]
) {
  const root = part(sliderValuesRoot.name, { defaultValue: [20, 80], step: 5, ...props });
  const track = part(sliderValuesTrack.name);
  const indicator = part(sliderValuesIndicator.name);
  const label = part(sliderValuesLabel.name);
  label.append('Volume range');
  const value = part(sliderValuesValue.name);
  value.append('caller Value slot must not replace the sorted display');
  const thumbs = indices.map((index) =>
    part(sliderValuesThumb.name, index === undefined ? {} : { index })
  );
  const marker = document.createElement('span');
  marker.textContent = 'caller Thumb slot';
  thumbs[0]?.append(marker);
  track.append(indicator, ...thumbs);
  root.append(label, track, value);
  document.body.append(root);
  await flush();
  return { root, track, indicator, label, value, thumbs, marker, x: root.getExposes() };
}
const paint = (element: HTMLElement) =>
  (element.shadowRoot ?? element).querySelector('[data-pui-owned-decoration], div')!;
const rendered = (element: HTMLElement) => element.shadowRoot ?? element;
async function key(thumb: Host, name: string) {
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  thumb.getExposes().focusSelf();
  await flush();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  await flush();
}

it('keeps Values slots and indexed keyboard/ARIA distinct from scalar Thumb', async () => {
  const f = await fixture({}, [undefined, undefined]);
  const commits: unknown[] = [];
  f.root.addEventListener('valueCommit', (event) =>
    commits.push((event as CustomEvent).detail.value)
  );
  expect(f.thumbs.map((thumb) => thumb.getExposes().index.get())).toEqual([0, 1]);
  expect(f.marker.parentElement).toBe(f.thumbs[0]);
  expect(f.label.textContent).toBe('Volume range');
  expect(f.track.parentElement).toBe(f.root);
  expect(f.thumbs[0].parentElement).toBe(f.track);
  expect(f.marker.isConnected).toBe(true);
  expect(rendered(f.value).textContent).toContain('20, 80');
  expect(rendered(f.value).textContent).not.toContain('caller Value slot');
  await key(f.thumbs[0], 'ArrowRight');
  expect(f.x.getValue()).toEqual([25, 80]);
  expect(commits).toEqual([[25, 80]]);
  expect(f.thumbs[0].getAttribute('role')).toBe('slider');
  expect(f.thumbs[0].getAttribute('aria-valuenow')).toBe('25');
  expect(f.thumbs[1].getAttribute('aria-valuenow')).toBe('80');
  expect(f.thumbs[0].getAttribute('aria-valuemin')).toBe('0');
  expect(f.thumbs[0].getAttribute('aria-valuemax')).toBe('100');
  expect(f.indicator.getExposes().startPercentage.get()).toBe(25);
  expect(f.indicator.getExposes().extent.get()).toBe(55);
  expect(paint(f.thumbs[0]).getAttribute('role')).toBeNull();
  expect(paint(f.thumbs[0]).getAttribute('tabindex')).toBeNull();
});

it('preserves controlled refusal, owner echo and synchronous veto without another value owner', async () => {
  const f = await fixture({ value: [80, 20] });
  const changes: unknown[] = [],
    commits: unknown[] = [];
  f.root.addEventListener('valueChange', (event) =>
    changes.push((event as CustomEvent).detail.value)
  );
  f.root.addEventListener('valueCommit', (event) =>
    commits.push((event as CustomEvent).detail.value)
  );
  await key(f.thumbs[0], 'ArrowRight');
  expect(changes).toEqual([[25, 80]]);
  expect(commits).toEqual([[25, 80]]);
  expect(f.x.getValue()).toEqual([80, 20]);
  expect(f.thumbs[0].getAttribute('aria-valuenow')).toBe('20');
  setElementProps(f.root, { value: [25, 80], step: 5 });
  await flush();
  expect(f.thumbs[0].getAttribute('aria-valuenow')).toBe('25');
  const veto = () => expect(f.x.cancelValueChange()).toBe(true);
  f.root.addEventListener('valueChange', veto);
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(false);
  expect(f.x.getValue()).toEqual([25, 80]);
  expect(commits).toEqual([[25, 80]]);
  f.root.removeEventListener('valueChange', veto);
  expect(f.x.cancelValueChange()).toBe(false);
});

it('fails closed on duplicate/empty mappings and preserves nodes while recovering disabled/readOnly policy', async () => {
  const f = await fixture({ value: [20, 80] });
  setElementProps(f.thumbs[1], { index: 0 });
  await flush();
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(false);
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(true);
  setElementProps(f.thumbs[1], { index: 1 });
  setElementProps(f.root, { value: [20, 80], step: 5, disabled: true });
  await flush();
  expect(f.thumbs[0].getAttribute('aria-disabled')).toBe('true');
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(false);
  setElementProps(f.root, { value: [20, 80], step: 5, readOnly: true });
  await flush();
  expect(f.thumbs[0].getAttribute('aria-readonly')).toBe('true');
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(false);
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(false);
  setElementProps(f.root, { value: [], step: 5 });
  await flush();
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(true);
  expect(f.track.contains(f.thumbs[0])).toBe(true);
  expect(f.marker.parentElement).toBe(f.thumbs[0]);
  setElementProps(f.root, { value: [20, 80], step: 5 });
  await flush();
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(false);
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(true);
});

it('retains display-segment selection and RTL/vertical keyboard constraints', async () => {
  const f = await fixture(
    { defaultValue: [20, 50, 80], orientation: 'vertical', direction: 'rtl' },
    [0, 1, 2]
  );
  const segment = part(sliderValuesIndicator.name, { startIndex: 0, endIndex: 1 });
  f.track.append(segment);
  await flush();
  await key(f.thumbs[0], 'ArrowRight');
  expect(f.x.getValue()).toEqual([15, 50, 80]);
  await key(f.thumbs[0], 'ArrowUp');
  expect(f.x.getValue()).toEqual([20, 50, 80]);
  expect(segment.getExposes().startPercentage.get()).toBe(20);
  expect(segment.getExposes().extent.get()).toBe(30);
  expect(f.thumbs[0].getAttribute('aria-orientation')).toBe('vertical');
});

const profiles = [
  ['vega', 'h-1.5', 'size-4', 'ring-4'],
  ['nova', 'h-1', 'size-3', 'ring-3'],
  ['maia', 'h-3', 'size-4', 'ring-4'],
  ['lyra', 'h-1', 'size-3', 'ring-1'],
  ['mira', 'h-1', 'size-3', 'ring-2'],
  ['luma', 'h-2', 'w-6', 'ring-4'],
  ['sera', 'h-0.5', 'size-3', 'ring-2'],
  ['rhea', 'h-1', 'size-4', 'ring-4'],
  ['new-york-v4', 'h-1.5', 'size-4', 'ring-4'],
] as const;
for (const [styleProfile, railSize, thumbSize, focusRing] of profiles)
  it(`projects ${styleProfile} source paint with one focus target and live style withdrawal`, async () => {
    const f = await fixture({ styleProfile });
    const thumb = f.thumbs[0],
      body = paint(thumb);
    expect(styleContains(paint(f.track), railSize)).toBe(true);
    expect(styleContains(body, thumbSize)).toBe(true);
    expect(body.hasAttribute('data-pui-owned-decoration')).toBe(true);
    expect(body.getAttribute('aria-hidden')).toBe('true');
    expect(body.getAttribute('tabindex')).toBeNull();
    await key(thumb, 'ArrowRight');
    expect(styleContains(body, focusRing)).toBe(true);
    expect(styleContains(body, 'forced-colors-focus-outline')).toBe(true);
    setElementProps(f.root, {
      defaultValue: [20, 80],
      step: 5,
      styleProfile: styleProfile === 'sera' ? 'vega' : 'sera',
    });
    await flush();
    expect(paint(thumb)).toBe(body);
    expect(f.marker.parentElement).toBe(thumb);
    expect(f.root.contains(thumb)).toBe(true);
    expect(f.marker.isConnected).toBe(true);
    expect(f.x.getValue()).toEqual([25, 80]);
    expect(styleContains(body, styleProfile === 'sera' ? 'bg-white' : 'bg-primary')).toBe(true);
    expect(styleContains(body, styleProfile === 'sera' ? 'bg-primary' : 'bg-white')).toBe(false);
  });

it('uses the compatibility Nova baseline and rotates Luma without creating a new Thumb', async () => {
  const f = await fixture();
  const thumb = f.thumbs[0];
  expect(styleContains(paint(f.track), 'h-1')).toBe(true);
  expect(styleContains(paint(thumb), 'size-3')).toBe(true);
  setElementProps(f.root, {
    defaultValue: [20, 80],
    styleProfile: 'luma',
    orientation: 'vertical',
  });
  await flush();
  expect(styleContains(paint(f.track), 'w-2')).toBe(true);
  const body = paint(thumb);
  expect(body.getAttribute('data-pui-style') ?? '').toContain('h-6');
  expect(body.getAttribute('data-pui-style') ?? '').toContain('w-4');
  expect(f.thumbs[0]).toBe(thumb);
  expect(f.x.getValue()).toEqual([20, 80]);
});
