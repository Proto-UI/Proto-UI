import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype } from '@proto.ui/core';
import {
  sliderValuesRoot,
  sliderValuesTrack,
  sliderValuesThumb,
  sliderValuesIndicator,
  sliderValuesLabel,
  sliderValuesValue,
  asSliderValuesRoot,
} from '../src/slider';
for (const p of [
  sliderValuesRoot,
  sliderValuesTrack,
  sliderValuesThumb,
  sliderValuesIndicator,
  sliderValuesLabel,
  sliderValuesValue,
])
  AdaptToWebComponent(p);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const part = (name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement(name) as any;
  setElementProps(el, props);
  return el;
};
async function fixture(props: Record<string, unknown> = {}, count = 0) {
  const root = part('base-slider-values-root', props),
    track = part('base-slider-values-track');
  const thumbs = Array.from({ length: count }, (_, index) =>
    part('base-slider-values-thumb', { index })
  );
  track.append(...thumbs);
  root.append(track);
  document.body.append(root);
  await flush();
  return {
    root,
    track,
    thumbs,
    x: root.getExposes(),
    update: async (p: Record<string, unknown>) => {
      setElementProps(root, p);
      await flush();
    },
  };
}
it('owns raw scalar while clamping display, and restores from current owner on wider bounds', async () => {
  const f = await fixture({ defaultValue: 70, max: 100 });
  expect(f.x.getValue()).toBe(70);
  await f.update({ max: 60 });
  expect(f.x.getValue()).toBe(70);
  expect(f.x.getDisplayValue()).toBe(60);
  await f.update({ max: 100 });
  expect(f.x.getDisplayValue()).toBe(70);
});
for (const min of [20, -30])
  it(`omitted default derives from resolved min ${min}`, async () => {
    const f = await fixture({ min, max: 100 });
    expect(f.x.getValue()).toBe(min);
    expect(f.x.getDisplayValue()).toBe(min);
  });
it('preserves unsorted owner and array shape while deriving sorted display', async () => {
  const input = Object.freeze([80, 20]);
  const f = await fixture({ value: input });
  expect(f.x.getValue()).toEqual([80, 20]);
  expect(f.x.getDisplayValue()).toEqual([20, 80]);
  expect(input).toEqual([80, 20]);
  await f.update({ value: [] });
  expect(f.x.getValue()).toEqual([]);
  expect(f.x.getDisplayValue()).toEqual([]);
  await f.update({ value: [7] });
  expect(f.x.getValue()).toEqual([7]);
});
it('does not quantize, impose global spacing or clamp array owner slots', async () => {
  const f = await fixture({
    defaultValue: [-10, 2.3, 2.3, 200],
    step: 7,
    minStepsBetweenValues: 5,
  });
  expect(f.x.getValue()).toEqual([-10, 2.3, 2.3, 200]);
  expect(f.x.getDisplayValue()).toEqual([-10, 2.3, 2.3, 200]);
});
for (const bad of [{ step: 0 }, { min: 100, max: 0 }])
  it(`recovers initial controlled policy ${JSON.stringify(bad)}`, async () => {
    const f = await fixture({ value: [20, 80], ...bad });
    expect(f.x.getValue()).toBeNull();
    await f.update({ value: [30, 70] });
    expect(f.x.getValue()).toEqual([30, 70]);
    expect(f.x.diagnostic.get()).toBe('');
  });
it('safe creation owner survives an initially invalid policy', async () => {
  const f = await fixture({ defaultValue: [20, 80], step: 0 });
  expect(f.x.getValue()).toBeNull();
  await f.update({ defaultValue: [30, 70], step: 1 });
  expect(f.x.getValue()).toEqual([20, 80]);
  expect(f.x.requestValues([40, 60])).toBe(true);
  expect(f.x.resetValue()).toBe(true);
  expect(f.x.getValue()).toEqual([20, 80]);
});
for (const value of [{}, [true]])
  it(`recovers wrong-shape resolved controlled input ${JSON.stringify(value)}`, async () => {
    const f = await fixture({ value });
    expect(f.x.getValue()).toBeNull();
    await f.update({ value: [30, 70] });
    expect(f.x.getValue()).toEqual([30, 70]);
  });
it('first safe resolved default after invalid shape becomes creation, then later defaults are ignored', async () => {
  const f = await fixture({ defaultValue: [true] });
  expect(f.x.getValue()).toBeNull();
  await f.update({ defaultValue: [20, 80] });
  expect(f.x.getValue()).toEqual([20, 80]);
  await f.update({ defaultValue: [30, 70] });
  expect(f.x.getValue()).toEqual([20, 80]);
  f.x.requestValues([40, 60]);
  f.x.resetValue();
  expect(f.x.getValue()).toEqual([20, 80]);
});
it('controlled mode changes are explicit while empty spellings do not create them', async () => {
  const f = await fixture({ defaultValue: 20 });
  await f.update({ defaultValue: 20, value: undefined });
  expect(f.x.getValue()).toBe(20);
  await f.update({ value: 30 });
  expect(f.x.getValue()).toBeNull();
  expect(f.x.diagnostic.get()).toBe('controlled-mode-change');
  await f.update({ defaultValue: 20 });
  expect(f.x.getValue()).toBe(20);
});
const composedValue = definePrototype({
  name: 'test-slider-values-default-layer',
  setup(def) {
    asSliderValuesRoot();
    def.props.setDefaults({ value: 50 });
    return (r) => r.slot();
  },
});
const composedDefault = definePrototype({
  name: 'test-slider-values-default-value-layer',
  setup(def) {
    asSliderValuesRoot();
    def.props.setDefaults({ defaultValue: 50 });
    return (r) => r.slot();
  },
});
AdaptToWebComponent(composedValue);
AdaptToWebComponent(composedDefault);
it('legal composed value default is controlled from creation, independently of physical providing', async () => {
  const root = part(composedValue.name, { defaultValue: 20 });
  document.body.append(root);
  await flush();
  const x = root.getExposes();
  expect(x.getValue()).toBe(50);
  expect(x.requestValue(60)).toBe(true);
  expect(x.getValue()).toBe(50);
  setElementProps(root, { defaultValue: 20, value: undefined, max: 90 });
  await flush();
  expect(x.getValue()).toBe(50);
  setElementProps(root, { defaultValue: 20, max: 90 });
  await flush();
  expect(x.getValue()).toBe(50);
  setElementProps(root, { value: 70 });
  await flush();
  expect(x.getValue()).toBe(70);
});
it('legal composed defaultValue initializes an uncontrolled owner', async () => {
  const root = part(composedDefault.name);
  document.body.append(root);
  await flush();
  const x = root.getExposes();
  expect(x.getValue()).toBe(50);
  expect(x.requestValue(60)).toBe(true);
  expect(x.getValue()).toBe(60);
});
it('synchronous veto only cancels its current notification and late calls are rejected', async () => {
  const f = await fixture({ defaultValue: [20, 80] });
  expect(f.x.cancelValueChange()).toBe(false);
  const changes: unknown[] = [];
  const listener = (event: Event) => {
    changes.push((event as CustomEvent).detail);
    expect(f.x.cancelValueChange()).toBe(true);
    expect(f.x.requestValues([1, 2])).toBe(false);
  };
  f.root.addEventListener('valueChange', listener);
  expect(f.x.requestValues([30, 70])).toBe(false);
  expect(f.x.getValue()).toEqual([20, 80]);
  f.root.removeEventListener('valueChange', listener);
  expect(f.x.requestValues([30, 70])).toBe(true);
  expect(f.x.getValue()).toEqual([30, 70]);
  expect(changes).toHaveLength(1);
  expect(f.x.cancelValueChange()).toBe(false);
});
it('controlled ignored proposal remains the last eligible commit even after same-owner no-op', async () => {
  const f = await fixture({ value: 50 }),
    changes: any[] = [],
    commits: any[] = [];
  f.root.addEventListener('valueChange', (e: CustomEvent) => changes.push(e.detail.value));
  f.root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail.value));
  expect(f.x.beginInteraction()).toBe(true);
  expect(f.x.requestValue(60)).toBe(true);
  expect(f.x.requestValue(50)).toBe(false);
  expect(f.x.getValue()).toBe(50);
  expect(f.x.commitValue()).toBe(true);
  expect(f.x.commitValue()).toBe(false);
  expect(changes).toEqual([60]);
  expect(commits).toEqual([60]);
});
it('net-zero logical roundtrip can commit, and cancellation does not restore owner', async () => {
  const f = await fixture({ defaultValue: 50 }),
    commits: any[] = [];
  f.root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail.value));
  f.x.beginInteraction();
  f.x.requestValue(60);
  f.x.requestValue(50);
  expect(f.x.commitValue()).toBe(true);
  expect(commits).toEqual([50]);
  f.x.beginInteraction();
  f.x.requestValue(70);
  f.x.cancelInteraction();
  expect(f.x.getValue()).toBe(70);
  expect(f.x.commitValue()).toBe(false);
});
it('controlled comparisons use raw order and raw unclamped scalar', async () => {
  const f = await fixture({ value: [80, 20] });
  expect(f.x.requestValues([20, 80])).toBe(true);
  expect(f.x.getValue()).toEqual([80, 20]);
  await f.update({ value: 200, max: 100 });
  expect(f.x.getDisplayValue()).toBe(100);
  expect(f.x.requestValue(100)).toBe(true);
  expect(f.x.getValue()).toBe(200);
});
it('direct method rejects accessor arrays without executing getters', async () => {
  const f = await fixture({ defaultValue: [20, 80] });
  let calls = 0;
  const data = [20, 80];
  Object.defineProperty(data, '0', {
    get() {
      calls++;
      return 30;
    },
  });
  expect(f.x.requestValues(data)).toBe(false);
  expect(calls).toBe(0);
  expect(f.x.getValue()).toEqual([20, 80]);
});
it('indexed keyboard reaches only its current mapped slot and projects ARIA', async () => {
  const f = await fixture({ defaultValue: [20, 80], step: 5 }, 2);
  const thumb = f.thumbs[0],
    x = thumb.getExposes();
  expect(x.value.get()).toBe(20);
  x.focusSelf();
  await flush();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await flush();
  expect(f.x.getValue()).toEqual([25, 80]);
  expect(x.value.get()).toBe(25);
  expect(thumb.getAttribute('aria-valuenow')).toBe('25');
  expect(thumb.getAttribute('aria-valuemin')).toBe('0');
  expect(thumb.getAttribute('aria-valuemax')).toBe('100');
});
it('mapping invalidity blocks edits then recovers, including empty owner and retained nodes', async () => {
  const f = await fixture({ value: [20, 80] }, 2);
  setElementProps(f.thumbs[1], { index: 0 });
  await flush();
  expect(f.x.requestThumbValue(0, 30)).toBe(false);
  setElementProps(f.thumbs[1], { index: 1 });
  await flush();
  expect(f.x.requestThumbValue(0, 30)).toBe(true);
  await f.update({ value: [] });
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(true);
  expect(f.x.requestThumbValue(0, 30)).toBe(false);
  await f.update({ value: [20, 80] });
  expect(f.thumbs[0].getExposes().disabled.get()).toBe(false);
});
it('direction changes only horizontal keys and readOnly blocks editing but preserves owner', async () => {
  const f = await fixture(
    { defaultValue: [20, 80], step: 5, direction: 'rtl', orientation: 'vertical' },
    2
  );
  expect(f.x.requestKeyboardValue(0, 'ArrowRight')).toBe(true);
  expect(f.x.getValue()).toEqual([15, 80]);
  expect(f.x.requestKeyboardValue(0, 'ArrowUp')).toBe(true);
  expect(f.x.getValue()).toEqual([20, 80]);
  await f.update({ readOnly: true });
  expect(f.x.requestKeyboardValue(0, 'End')).toBe(false);
  expect(f.x.getValue()).toEqual([20, 80]);
});
it('multiple indicators and Value read derived sorted display', async () => {
  const f = await fixture({ value: [80, 20, 50] }, 3),
    a = part('base-slider-values-indicator'),
    b = part('base-slider-values-indicator', { startIndex: 0, endIndex: 1 }),
    v = part('base-slider-values-value');
  f.track.append(a, b);
  f.root.append(v);
  await flush();
  expect(a.getExposes().startPercentage.get()).toBe(20);
  expect(a.getExposes().endPercentage.get()).toBe(80);
  expect(b.getExposes().extent.get()).toBe(30);
  expect(v.textContent).toBe('20, 50, 80');
});
it('effective disabled/readOnly facts still follow Props when numerical configuration is invalid', async () => {
  const f = await fixture({ value: [20, 80], step: 0, disabled: true });
  expect(f.x.disabled.get()).toBe(true);
  await f.update({ value: [true], readOnly: true });
  expect(f.x.readOnly.get()).toBe(true);
  expect(f.x.disabled.get()).toBe(false);
  expect(f.x.getValue()).toBeNull();
});
it('direct vector method delegates unsafe reflection to its diagnostic guard', async () => {
  const f = await fixture({ defaultValue: [20, 80] });
  const proxy = Proxy.revocable([30, 70], {});
  proxy.revoke();
  expect(f.x.requestValues(proxy.proxy)).toBe(false);
  expect(f.x.getValue()).toEqual([20, 80]);
});
