import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/progress';
import * as shadcn from '../../shadcn/src/progress';
import * as brutalist from '../../brutalist/src/progress';
import * as bootstrap from '../../bootstrap-2-3-2/src/progress';
import * as liquid from '../../liquid-glass/src/progress';
import { meterRoot } from '../src/meter';
import { sliderRoot } from '../src/slider';
import { percentage } from '../src/progress/range';
AdaptToWebComponent(meterRoot);
AdaptToWebComponent(sliderRoot);
const families = { base, shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
for (const group of Object.values(families))
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
function fixture(family: string, props: Record<string, unknown> = {}) {
  const root = document.createElement(`${family}-progress-root`) as any;
  const label = document.createElement(`${family}-progress-label`) as any;
  const track = document.createElement(`${family}-progress-track`) as any;
  const indicator = document.createElement(`${family}-progress-indicator`) as any;
  const value = document.createElement(`${family}-progress-value`) as any;
  label.textContent = 'Transfer';
  track.append(indicator);
  root.append(label, track, value);
  setElementProps(root, props);
  document.body.append(root);
  return { root, label, track, indicator, value };
}
// C-STATE-0006's JSON-compatible range, independent of any Compiler admission.
it('finite extreme bounds never publish a non-finite percentage', () => {
  const limit = Number.MAX_VALUE;
  expect.soft(percentage(0, -limit, limit)).toBe(50);
  expect.soft(percentage(limit, -limit, limit)).toBe(100);
  expect.soft(percentage(-limit, -limit, limit)).toBe(0);
  expect(percentage(Number.MIN_VALUE, 0, 2 * Number.MIN_VALUE)).toBe(50);
  expect(percentage(0, 0, 0)).toBe(0);
  expect(percentage(25, 0, 100)).toBe(25);
  expect(percentage(100, 0, 100)).toBe(100);
});
for (const kind of ['meter', 'slider'])
  it(`${kind} keeps the shared percentage finite across an overflowing span`, async () => {
    const root = document.createElement(`base-${kind}-root`) as any;
    setElementProps(root, { min: -Number.MAX_VALUE, max: Number.MAX_VALUE, value: 0 });
    document.body.append(root);
    await flush();
    expect(root.getExposes().percentage.get()).toBe(50);
    setElementProps(root, {
      min: -Number.MAX_VALUE,
      max: Number.MAX_VALUE,
      value: Number.MAX_VALUE,
    });
    await flush();
    expect(root.getExposes().percentage.get()).toBe(100);
  });
for (const family of Object.keys(families)) {
  it(`${family} keeps every exposed percentage finite at extreme finite bounds`, async () => {
    const limit = Number.MAX_VALUE;
    const f = fixture(family, { min: -limit, max: limit, value: 0 });
    await flush();
    for (const part of Object.values(f)) expect(part.getExposes().percentage.get()).toBe(50);
    setElementProps(f.root, { min: -limit, max: limit, value: limit });
    await flush();
    for (const part of Object.values(f)) expect(part.getExposes().percentage.get()).toBe(100);
    expect(f.root.getAttribute('aria-valuenow')).toBe(String(limit));
  });
  it(`${family} omitted progress is passive and has no fabricated accessible current value`, async () => {
    const f = fixture(family);
    await flush();
    for (const part of Object.values(f)) {
      const e = part.getExposes();
      expect(e.indeterminate.get()).toBe(true);
      expect(e.percentage.get()).toBe(0);
      expect(e.status.get()).toBe('indeterminate');
      expect(part.hasAttribute('tabindex')).toBe(false);
    }
    expect(f.root.getAttribute('role')).toBe('progressbar');
    expect(f.root.hasAttribute('aria-valuenow')).toBe(false);
    expect(f.value.textContent).toBe('');
    expect(f.root.getAttribute('aria-labelledby')).toBe(f.label.id);
    expect(f.indicator.getAttribute('aria-hidden')).toBe('true');
  });
  it(`${family} all parts follow typed owner updates without editing ownership`, async () => {
    const f = fixture(family, { min: -20, max: 20, value: -10, valueText: 'One quarter' });
    await flush();
    for (const part of Object.values(f)) {
      const e = part.getExposes();
      expect(e.value.get()).toBe(-10);
      expect(e.percentage.get()).toBe(25);
      expect(e.indeterminate.get()).toBe(false);
      expect(e.status.get()).toBe('loading');
    }
    expect(f.value.textContent).toBe('One quarter');
    expect(f.root.getAttribute('aria-valuemin')).toBe('-20');
    expect(f.root.getAttribute('aria-valuemax')).toBe('20');
    expect(f.root.getAttribute('aria-valuenow')).toBe('-10');
    f.root.click();
    f.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(f.root.getExposes().value.get()).toBe(-10);
    setElementProps(f.root, { min: 5, max: 5, value: 9 });
    await flush();
    expect(f.value.textContent).toBe('5');
    expect(f.indicator.getExposes().percentage.get()).toBe(0);
    expect(f.root.getExposes().status.get()).toBe('complete');
    setElementProps(f.root, { indeterminate: false });
    await flush();
    expect(f.root.getExposes().indeterminate.get()).toBe(true);
    expect(f.root.hasAttribute('aria-valuenow')).toBe(false);
  });
  it(`${family} reconnect and scoped movement resolve the current Progress owner`, async () => {
    const first = fixture(family, { value: 25 });
    const second = fixture(family, { value: 80, valueText: 'Current owner' });
    await flush();
    first.value.remove();
    await flush();
    setElementProps(first.root, { value: 40 });
    await flush();
    second.root.append(first.value);
    await flush();
    expect(first.value.getExposes().value.get()).toBe(80);
    expect(first.value.textContent).toBe('Current owner');
    setElementProps(first.root, { value: 90 });
    await flush();
    expect(first.value.getExposes().value.get()).toBe(80);
    second.root.remove();
    await flush();
    document.body.append(second.root);
    await flush();
    expect(first.value.getExposes().value.get()).toBe(80);
    expect(first.value.textContent).toBe('Current owner');
  });
}
