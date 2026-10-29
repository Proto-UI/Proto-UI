import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { AdapterPrototype } from '@proto.ui/adapter-base';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { styleContains } from '../../test-utils/style';
import { checkboxRoot, checkboxIndicator } from '../src/checkbox';
import { checkboxGroupRoot, checkboxGroupItem, checkboxGroupAll } from '../src/checkbox-group';
import {
  shadcnRadioGroupRoot,
  shadcnRadioGroupItem,
  shadcnRadioGroupIndicator,
} from '../src/radio-group';
import { switchRoot, switchThumb } from '../src/switch';
import { fieldRoot, fieldSwitch, fieldLabel } from '../src/field';
import { styleScope } from '../src/style-scope';

for (const prototype of [
  styleScope,
  checkboxRoot,
  checkboxIndicator,
  checkboxGroupRoot,
  checkboxGroupItem,
  checkboxGroupAll,
  shadcnRadioGroupRoot,
  shadcnRadioGroupItem,
  shadcnRadioGroupIndicator,
  switchRoot,
  switchThumb,
  fieldRoot,
  fieldSwitch,
  fieldLabel,
])
  AdaptToWebComponent(prototype);

function element<TProto extends AdapterPrototype>(
  prototype: TProto,
  props: Record<string, unknown> = {}
) {
  // The constructor is registered from this exact Prototype above.
  const result = document.createElement(prototype.name) as WebComponentAdapterElement<TProto>;
  setElementProps(result, props);
  return result;
}
async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  // Drain the real glyph delay(0) scheduler deterministically, not a guessed wait.
  await vi.advanceTimersByTimeAsync(0);
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}
function scoped(profile: string, child: HTMLElement) {
  const scope = element(styleScope, { styleProfile: profile });
  scope.append(child);
  document.body.append(scope);
  return scope;
}
function focusVisible(target: HTMLElement) {
  const matches = target.matches.bind(target);
  vi.spyOn(target, 'matches').mockImplementation(
    (selector) => selector === ':focus-visible' || matches(selector)
  );
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  target.focus();
}
const sheet = document.createElement('style');
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
beforeAll(() => {
  // Real source CSS producer; only position/display is needed by the bounded
  // host hit-region acquisition. This is not an optical/layout evidence claim.
  sheet.textContent = renderProtoStyleTokenCss(['relative', 'inline-flex'])
    .replace('@layer proto-ui {', '')
    .replace(/}\s*$/, '');
  document.head.append(sheet);
});
afterEach(async () => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
  await settle();
  vi.useRealTimers();
});
afterAll(() => sheet.remove());

const SWITCH_RECIPES = [
  [
    'vega',
    'h-[18.4px]',
    'w-[32px]',
    'size-4',
    'translate-x-[calc(100%_-_2px)]',
    'h-[14px]',
    'w-[24px]',
    'size-3',
  ],
  [
    'nova',
    'h-[18.4px]',
    'w-[32px]',
    'size-4',
    'translate-x-[calc(100%_-_2px)]',
    'h-[14px]',
    'w-[24px]',
    'size-3',
  ],
  [
    'maia',
    'h-[18.4px]',
    'w-[32px]',
    'size-4',
    'translate-x-[calc(100%_-_2px)]',
    'h-[14px]',
    'w-[24px]',
    'size-3',
  ],
  [
    'lyra',
    'h-[18.4px]',
    'w-[32px]',
    'size-4',
    'translate-x-[calc(100%_-_2px)]',
    'h-[14px]',
    'w-[24px]',
    'size-3',
  ],
  [
    'mira',
    'h-[16.6px]',
    'w-[28px]',
    'size-3.5',
    'translate-x-[calc(100%_-_2px)]',
    'h-[14px]',
    'w-[24px]',
    'size-3',
  ],
  ['luma', 'h-5', 'w-11', 'w-6', 'translate-x-[calc(100%_-_8px)]', 'h-4', 'w-7', 'w-4'],
  [
    'sera',
    'h-4.5',
    'w-8.25',
    'size-3.5',
    'translate-x-[calc(100%_+_2px)]',
    'h-3.5',
    'w-6.25',
    'size-2.5',
  ],
  ['rhea', 'h-5', 'w-8', 'size-4', 'translate-x-[calc(100%_-_4px)]', 'h-4', 'w-6', 'size-3'],
  [
    'new-york-v4',
    'h-[1.15rem]',
    'w-8',
    'size-4',
    'translate-x-[calc(100%_-_2px)]',
    'h-3.5',
    'w-6',
    'size-3',
  ],
] as const;

describe('source-bound binary profiles retain Base ownership', () => {
  it('withdraws all nine Switch geometries and travel without replacing caller Thumb or value', async () => {
    const root = element(switchRoot, { checked: true });
    const thumb = element(switchThumb);
    root.append(thumb);
    const scope = scoped('vega', root);
    await settle();
    const checked = root.getExposes().checked;
    const changes: unknown[] = [];
    root.addEventListener('checkedChange', (event) => changes.push((event as CustomEvent).detail));
    let previous: (typeof SWITCH_RECIPES)[number] | null = null;
    for (const recipe of SWITCH_RECIPES) {
      const [profile, height, width, thumbSize, translate, smallHeight, smallWidth, smallThumb] =
        recipe;
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(root.getExposes().getVisualStyle()).toBe(profile);
      expect(styleContains(root, height)).toBe(true);
      expect(styleContains(root, width)).toBe(true);
      expect(styleContains(thumb, thumbSize)).toBe(true);
      expect(styleContains(thumb, translate)).toBe(true);
      if (previous && previous[1] !== height) expect(styleContains(root, previous[1])).toBe(false);
      if (previous && previous[2] !== width) expect(styleContains(root, previous[2])).toBe(false);
      if (previous && previous[4] !== translate)
        expect(styleContains(thumb, previous[4])).toBe(false);
      expect(root.getExposes().checked).toBe(checked);
      expect(checked.get()).toBe(true);
      expect(root.firstElementChild).toBe(thumb);
      expect(root.hasAttribute('data-pui-static-hit')).toBe(profile === 'rhea');
      setElementProps(root, { checked: true, size: 'sm' });
      await settle();
      expect(styleContains(root, smallHeight)).toBe(true);
      expect(styleContains(root, smallWidth)).toBe(true);
      expect(styleContains(thumb, smallThumb)).toBe(true);
      expect(styleContains(root, height)).toBe(false);
      expect(root.getExposes().getVisualSize()).toBe('sm');
      expect(root.getExposes().checked).toBe(checked);
      setElementProps(root, { checked: true });
      await settle();
      expect(root.getExposes().getVisualSize()).toBe('default');
      expect(styleContains(root, height)).toBe(true);
      expect(styleContains(root, smallHeight)).toBe(false);
      previous = recipe;
    }
    expect(changes).toEqual([]);
  });

  it('restores inherited Switch profile and default source size after raw prop removal', async () => {
    const root = element(switchRoot, { checked: false, styleProfile: 'mira', size: 'sm' });
    const thumb = element(switchThumb);
    root.append(thumb);
    const scope = scoped('rhea', root);
    await settle();
    const checked = root.getExposes().checked;
    expect(root.getExposes().getVisualStyle()).toBe('mira');
    expect(styleContains(root, 'h-[14px]')).toBe(true);
    expect(styleContains(thumb, 'size-3')).toBe(true);
    expect(root.hasAttribute('data-pui-static-hit')).toBe(false);
    setElementProps(scope, { styleProfile: 'luma' });
    await settle();
    expect(root.getExposes().getVisualStyle()).toBe('mira');
    // Entire raw bag replacement removes both local selector and local size.
    setElementProps(root, { checked: false });
    await settle();
    expect(root.getExposes().getVisualStyle()).toBe('luma');
    expect(root.getExposes().getVisualSize()).toBe('default');
    expect(styleContains(root, 'w-11')).toBe(true);
    expect(styleContains(thumb, 'h-4')).toBe(true);
    expect(styleContains(thumb, 'w-6')).toBe(true);
    expect(styleContains(thumb, 'size-3')).toBe(false);
    expect(root.getExposes().checked).toBe(checked);
    root.click();
    await settle();
    expect(checked.get()).toBe(false); // controlled refusal survives the removal
    setElementProps(root, { checked: true, disabled: true });
    await settle();
    root.click();
    await settle();
    expect(checked.get()).toBe(true);
    expect(root.getAttribute('aria-disabled')).toBe('true');
    setElementProps(scope, { styleProfile: 'rhea' });
    await settle();
    expect(root.hasAttribute('data-pui-static-hit')).toBe(true);
    setElementProps(scope, {});
    await settle();
    expect(root.getExposes().getVisualStyle()).toBe('new-york-v4');
    expect(root.hasAttribute('data-pui-static-hit')).toBe(false);
    expect(root.firstElementChild).toBe(thumb);
  });

  it('keeps actual Switch Root style above a conflicting Thumb-local surrounding scope', async () => {
    const root = element(switchRoot, { styleProfile: 'sera', checked: true });
    const misleading = element(styleScope, { styleProfile: 'luma' });
    const thumb = element(switchThumb);
    misleading.append(thumb);
    root.append(misleading);
    scoped('rhea', root);
    await settle();
    expect(styleContains(thumb, 'rounded-none')).toBe(true);
    expect(styleContains(thumb, 'translate-x-[calc(100%_+_2px)]')).toBe(true);
    expect(styleContains(thumb, 'shadow-sm')).toBe(false);
    setElementProps(root, { styleProfile: 'mira', checked: true });
    await settle();
    expect(styleContains(thumb, 'rounded-full')).toBe(true);
    expect(styleContains(thumb, 'size-3.5')).toBe(true);
    expect(styleContains(thumb, 'translate-x-[calc(100%_-_2px)]')).toBe(true);
    expect(styleContains(thumb, 'translate-x-[calc(100%_+_2px)]')).toBe(false);
  });

  it('repaints live light/dark Switch palette without reselecting or changing checked', async () => {
    const root = element(switchRoot, { checked: false });
    const thumb = element(switchThumb);
    root.append(thumb);
    const scope = scoped('mira', root);
    await settle();
    const checked = root.getExposes().checked;
    expect(styleContains(root, 'bg-input')).toBe(true);
    document.documentElement.dataset.theme = 'dark';
    await settle();
    expect(styleContains(root, 'bg-input/80')).toBe(true);
    expect(styleContains(root, 'bg-input')).toBe(false);
    expect(styleContains(thumb, 'bg-foreground')).toBe(true);
    setElementProps(scope, { styleProfile: 'luma' });
    await settle();
    expect(styleContains(root, 'bg-input/90')).toBe(true);
    expect(styleContains(root, 'bg-input/80')).toBe(false);
    expect(styleContains(thumb, 'bg-clip-padding')).toBe(false);
    document.documentElement.dataset.theme = 'light';
    await settle();
    expect(styleContains(thumb, 'bg-foreground')).toBe(false);
    expect(styleContains(thumb, 'bg-clip-padding')).toBe(true);
    expect(root.getExposes().checked).toBe(checked);
    expect(checked.get()).toBe(false);
  });

  it('uses real optional Field policy and invalid facts across focus/profile transitions', async () => {
    const field = element(fieldRoot);
    const label = element(fieldLabel);
    label.textContent = 'Notifications';
    const root = element(fieldSwitch, { styleProfile: 'lyra', checked: false });
    const thumb = element(switchThumb);
    root.append(thumb);
    field.append(label, root);
    document.body.append(field);
    await settle();
    const checked = root.getExposes().checked;
    focusVisible(root);
    await settle();
    expect(styleContains(root, 'ring-1')).toBe(true);
    setElementProps(field, { invalid: true, readOnly: true, errors: ['Invalid'] });
    await settle();
    expect(root.getAttribute('aria-labelledby')).toBe(label.id);
    expect(root.getAttribute('aria-invalid')).toBe('true');
    expect(styleContains(root, 'ring-destructive/20')).toBe(true);
    expect(styleContains(root, 'ring-ring/50')).toBe(false);
    setElementProps(root, { styleProfile: 'sera', checked: false });
    await settle();
    expect(styleContains(root, 'ring-2')).toBe(true);
    expect(styleContains(root, 'ring-1')).toBe(false);
    expect(styleContains(root, 'border-destructive')).toBe(true);
    root.click();
    await settle();
    expect(checked.get()).toBe(false);
    setElementProps(field, { disabled: true });
    await settle();
    expect(root.getAttribute('aria-disabled')).toBe('true');
    root.click();
    await settle();
    expect(checked.get()).toBe(false);
    expect(root.getExposes().checked).toBe(checked);
    expect(root.firstElementChild).toBe(thumb);
    expect(root.getAttribute('data-pui-style')).not.toContain('destructive');
  });

  it('preserves Checkbox checked/mixed owners while scoped and explicit surfaces withdraw', async () => {
    const root = element(checkboxRoot, { checked: true, indeterminate: true });
    const indicator = element(checkboxIndicator);
    root.append(indicator);
    const scope = scoped('maia', root);
    await settle();
    const checked = root.getExposes().checked;
    const mixed = root.getExposes().indeterminate;
    expect(styleContains(root, 'rounded-[6px]')).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('mixed');
    expect(indicator.querySelector('path')?.getAttribute('d')).toBe('M5 12h14');
    for (const [profile, radius, size] of [
      ['vega', 'rounded-[4px]', 'size-4'],
      ['nova', 'rounded-[4px]', 'size-4'],
      ['lyra', 'rounded-none', 'size-4'],
      ['mira', 'rounded-[4px]', 'size-4'],
      ['luma', 'rounded-[5px]', 'size-4'],
      ['sera', 'rounded-none', 'size-4.5'],
      ['rhea', 'rounded-[5px]', 'size-4'],
      ['new-york-v4', 'rounded-[4px]', 'size-4'],
    ]) {
      setElementProps(scope, { styleProfile: profile });
      await settle();
      expect(styleContains(root, radius)).toBe(true);
      expect(styleContains(root, size)).toBe(true);
      expect(styleContains(root, 'rounded-[6px]')).toBe(false);
      expect(root.getExposes().checked).toBe(checked);
      expect(root.getExposes().indeterminate).toBe(mixed);
      expect(root.getAttribute('aria-checked')).toBe('mixed');
      expect(root.firstElementChild).toBe(indicator);
    }
    setElementProps(root, {
      styleProfile: 'maia',
      checked: false,
      indeterminate: false,
      disabled: true,
    });
    await settle();
    root.click();
    await settle();
    expect(checked.get()).toBe(false);
    expect(mixed.get()).toBe(false);
    expect(indicator.querySelector('path')).toBeNull();
    setElementProps(root, { checked: true, indeterminate: false });
    await settle();
    expect(styleContains(root, 'rounded-[4px]')).toBe(true);
    expect(styleContains(root, 'rounded-[6px]')).toBe(false);
    expect(indicator.querySelector('path')?.getAttribute('d')).toBe('m20 6-11 11-5-5');
    root.click();
    await settle();
    expect(checked.get()).toBe(true); // controlled request cannot change the owner
  });

  it('styles Checkbox Group Item and All from the group scope without a second selection owner', async () => {
    const root = element(checkboxGroupRoot, { defaultValue: ['a'] });
    const a = element(checkboxGroupItem, { value: 'a' });
    const b = element(checkboxGroupItem, { value: 'b' });
    const all = element(checkboxGroupAll);
    a.textContent = 'A';
    b.textContent = 'B';
    all.textContent = 'All';
    root.append(a, b, all);
    const scope = scoped('luma', root);
    await settle();
    const getValue = root.getExposes().getValue;
    expect(getValue()).toEqual(['a']);
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    expect(all.querySelector('path')?.getAttribute('d')).toBe('M5 12h14');
    expect(styleContains(b.querySelector('span')!, 'bg-input/90')).toBe(true);
    setElementProps(root, { styleProfile: 'sera' });
    await settle();
    for (const item of [a, b, all]) {
      expect(styleContains(item.querySelector('span')!, 'size-4.5')).toBe(true);
      expect(styleContains(item.querySelector('span')!, 'rounded-none')).toBe(true);
      expect(styleContains(item.querySelector('span')!, 'rounded-[5px]')).toBe(false);
    }
    expect(root.getExposes().getValue).toBe(getValue);
    expect(getValue()).toEqual(['a']);
    setElementProps(root, { disabled: true }); // removes local Sera -> inherited Luma
    await settle();
    all.click();
    b.click();
    await settle();
    expect(getValue()).toEqual(['a']);
    expect(styleContains(all.querySelector('span')!, 'rounded-[5px]')).toBe(true);
    expect(all.getAttribute('aria-disabled')).toBe('true');
    setElementProps(scope, { styleProfile: 'lyra' });
    await settle();
    expect(styleContains(all.querySelector('span')!, 'rounded-none')).toBe(true);
    expect(styleContains(all.querySelector('span')!, 'rounded-[5px]')).toBe(false);
    expect(all.querySelector('path')?.getAttribute('d')).toBe('M5 12h14');
  });

  it('keeps Radio controlled refusal, value/focus and actual Item indicator while styles change', async () => {
    const root = element(shadcnRadioGroupRoot, { value: 'a', a11yLabel: 'Delivery' });
    const a = element(shadcnRadioGroupItem, { value: 'a' });
    const b = element(shadcnRadioGroupItem, { value: 'b' });
    const dot = element(shadcnRadioGroupIndicator);
    a.append(dot);
    a.append('A');
    b.append('B');
    root.append(a, b);
    const scope = scoped('nova', root);
    await settle();
    const value = root.getExposes().value;
    const checked = a.getExposes().checked;
    const svg = dot.querySelector('svg');
    const changes: string[] = [];
    root.addEventListener('valueChange', (event) =>
      changes.push((event as CustomEvent).detail.value)
    );
    b.click();
    await settle();
    expect(changes).toEqual(['b']);
    expect(value.get()).toBe('a');
    expect(checked.get()).toBe(true);
    focusVisible(a);
    await settle();
    expect(document.activeElement).toBe(a);
    setElementProps(a, { value: 'a', styleProfile: 'sera' });
    await settle();
    expect(styleContains(a, 'size-4.5')).toBe(true);
    expect(styleContains(a, 'bg-primary')).toBe(false);
    expect(styleContains(dot, 'text-foreground')).toBe(true);
    setElementProps(scope, { styleProfile: 'rhea' });
    document.documentElement.dataset.theme = 'dark';
    await settle();
    expect(styleContains(dot, 'size-2.5')).toBe(false); // explicit Item Sera wins
    setElementProps(a, { value: 'a' }); // raw local selector removal follows actual Item
    await settle();
    expect(styleContains(a, 'rounded-[var(--pui-radius-2xl)]')).toBe(true);
    expect(styleContains(dot, 'text-primary-foreground')).toBe(true);
    expect(styleContains(dot, 'size-2.5')).toBe(true);
    expect(styleContains(dot, 'text-foreground')).toBe(false);
    expect(document.activeElement).toBe(a);
    setElementProps(root, { value: 'a', disabled: true });
    await settle();
    b.click();
    await settle();
    expect(changes).toEqual(['b']);
    expect(a.getAttribute('aria-disabled')).toBe('true');
    expect(root.getExposes().value).toBe(value);
    expect(a.getExposes().checked).toBe(checked);
    expect(dot.querySelector('svg')).toBe(svg);
    expect(checked.get()).toBe(true);
  });

  it('distinguishes explicit New York outlined Radio from the preserved Nova compatibility fallback', async () => {
    const root = element(shadcnRadioGroupRoot, { defaultValue: 'a' });
    const item = element(shadcnRadioGroupItem, { value: 'a' });
    const dot = element(shadcnRadioGroupIndicator);
    item.append(dot);
    root.append(item);
    document.body.append(root);
    await settle();
    expect(styleContains(root, 'gap-2')).toBe(true);
    expect(styleContains(item, 'bg-primary')).toBe(true);
    expect(styleContains(dot, 'text-primary-foreground')).toBe(true);
    setElementProps(root, { styleProfile: 'new-york-v4' });
    await settle();
    expect(styleContains(root, 'gap-3')).toBe(true);
    expect(styleContains(root, 'gap-2')).toBe(false);
    expect(styleContains(item, 'shadow-xs')).toBe(true);
    expect(styleContains(item, 'bg-primary')).toBe(false);
    expect(styleContains(dot, 'text-primary')).toBe(true);
    expect(item.getAttribute('aria-checked')).toBe('true');
    setElementProps(root, {});
    await settle();
    expect(styleContains(root, 'gap-2')).toBe(true);
    expect(styleContains(root, 'gap-3')).toBe(false);
    expect(styleContains(item, 'shadow-xs')).toBe(false);
    expect(styleContains(item, 'bg-primary')).toBe(true);
    expect(item.getAttribute('aria-checked')).toBe('true');
  });
});
