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
  label.append('Price range');
  const value = part(sliderValuesValue.name);
  value.append('caller Value slot must not replace display');
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
async function key(thumb: Host, name: string) {
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  thumb.getExposes().focusSelf();
  await flush();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  await flush();
}

it('renders the real Values slots and routes each indexed keyboard request through its Root', async () => {
  const f = await fixture({}, [undefined, undefined]);
  const commits: unknown[] = [];
  f.root.addEventListener('valueCommit', (event) =>
    commits.push((event as CustomEvent).detail.value)
  );
  expect(f.thumbs.map((thumb) => thumb.getExposes().index.get())).toEqual([0, 1]);
  expect(f.track.parentElement).toBe(f.root);
  expect(f.thumbs[0].parentElement).toBe(f.track);
  expect(f.marker.isConnected).toBe(true);
  expect(f.marker.parentElement).toBe(f.thumbs[0]);
  expect(f.label.textContent).toBe('Price range');
  expect((f.value.shadowRoot ?? f.value).textContent).toContain('20, 80');
  expect((f.value.shadowRoot ?? f.value).textContent).not.toContain('caller Value slot');
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
  // This extension reuses historical form/button units, not modern Bootstrap.
  expect(styleContains(f.track, 'h-[6px]')).toBe(true);
  expect(styleContains(f.thumbs[0], 'rounded-[4px]')).toBe(true);
  expect(styleContains(f.label, 'mb-[5px]')).toBe(true);
});

it('keeps controlled owner order authoritative while committing ignored keyboard proposals and honoring veto', async () => {
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

it('blocks duplicate/empty mappings and disabled/readOnly editing without removing caller nodes', async () => {
  const f = await fixture({ value: [20, 80] });
  setElementProps(f.thumbs[1], { index: 0 });
  await flush();
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(false);
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(true);
  setElementProps(f.thumbs[1], { index: 1 });
  setElementProps(f.root, { value: [20, 80], step: 5, disabled: true });
  await flush();
  expect(f.thumbs[0].getAttribute('aria-disabled')).toBe('true');
  await key(f.thumbs[0], 'ArrowRight');
  expect(f.x.getValue()).toEqual([20, 80]);
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

it('preserves segment selectors, root ARIA and RTL/vertical key intent', async () => {
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
  expect(f.thumbs[0].getAttribute('aria-orientation')).toBe('vertical');
  expect(segment.getExposes().startPercentage.get()).toBe(20);
  expect(segment.getExposes().extent.get()).toBe(30);
  expect(segment.getAttribute('aria-hidden')).toBe('true');
  expect(styleContains(f.track, 'data-[orientation=vertical]:w-[6px]')).toBe(true);
});
