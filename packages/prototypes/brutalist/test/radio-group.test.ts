import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  BrutalistRadioGroupIndicator,
  BrutalistRadioGroupItem,
  BrutalistRadioGroupRoot,
  brutalistRadioGroupIndicator,
  brutalistRadioGroupItem,
  brutalistRadioGroupRoot,
} from '../src/radio-group';
import * as BrutalistPackage from '../src';
import * as RadioGroupEntry from '../src/radio-group';
import type { BrutalistRadioGroupRootProps } from '../src/radio-group';

type HasUnsupportedRootApi =
  Extract<
    'onValueChange' | 'required' | 'name' | 'form' | 'orientation',
    keyof BrutalistRadioGroupRootProps
  > extends never
    ? false
    : true;

type ExposingElement = HTMLElement & { getExposes(): Record<string, any> };

const ROOT_SURFACE_TOKENS = ['grid', 'w-full', 'gap-2'];
const ITEM_SURFACE_TOKENS = [
  'inline-flex',
  'aspect-square',
  'size-4',
  'items-center',
  'justify-center',
  'rounded-full',
  'border-2',
  'border-border',
  'bg-transparent',
  'text-black',
  'outline-none',
  'select-none',
  'transition-none',
];
const INDICATOR_SURFACE_TOKENS = [
  'flex',
  'size-2',
  'items-center',
  'justify-center',
  'text-current',
  'opacity-0',
  'transition-none',
];

AdaptToWebComponent(BrutalistRadioGroupRoot as any);
AdaptToWebComponent(BrutalistRadioGroupItem as any);
AdaptToWebComponent(BrutalistRadioGroupIndicator as any);

async function settle(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function mount(
  props: Record<string, unknown> = {},
  items: Record<string, unknown>[] = [{ value: 'a' }, { value: 'b' }]
) {
  const root = document.createElement(BrutalistRadioGroupRoot.name) as ExposingElement;
  const mounted: { element: ExposingElement; indicator: ExposingElement }[] = [];
  for (const itemProps of items) {
    const item = document.createElement(BrutalistRadioGroupItem.name) as ExposingElement;
    const indicator = document.createElement(BrutalistRadioGroupIndicator.name) as ExposingElement;
    item.appendChild(indicator);
    root.appendChild(item);
    mounted.push({ element: item, indicator });
  }
  setElementProps(root, props as any);
  mounted.forEach(({ element }, index) => setElementProps(element, items[index] as any));
  document.body.appendChild(root);
  await settle();
  return { root, items: mounted };
}

function prototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

// Keep the package-wide set exact instead of filtering to already-known keys,
// which could hide new accidental radio exports.
const EXPECTED_RADIO_GROUP_EXPORTS = {
  BrutalistRadioGroupIndicator: 'brutalist-radio-group-indicator',
  BrutalistRadioGroupItem: 'brutalist-radio-group-item',
  BrutalistRadioGroupRoot: 'brutalist-radio-group-root',
  brutalistRadioGroupIndicator: 'brutalist-radio-group-indicator',
  brutalistRadioGroupItem: 'brutalist-radio-group-item',
  brutalistRadioGroupRoot: 'brutalist-radio-group-root',
};

function radioGroupExports(entry: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(
        ([name, value]) =>
          name.toLowerCase().includes('radiogroup') ||
          prototypeName(value)?.startsWith('brutalist-radio-group-')
      )
      .map(([name, value]) => [name, prototypeName(value)])
  );
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('prototypes/brutalist: radio-group', () => {
  it('exports exactly the admitted Root, Item, and Indicator values through family and package entries', () => {
    expect(brutalistRadioGroupRoot).toBe(BrutalistRadioGroupRoot);
    expect(brutalistRadioGroupItem).toBe(BrutalistRadioGroupItem);
    expect(brutalistRadioGroupIndicator).toBe(BrutalistRadioGroupIndicator);
    expect(BrutalistRadioGroupRoot.name).toBe('brutalist-radio-group-root');
    expect(BrutalistRadioGroupItem.name).toBe('brutalist-radio-group-item');
    expect(BrutalistRadioGroupIndicator.name).toBe('brutalist-radio-group-indicator');
    expect(radioGroupExports(BrutalistPackage)).toEqual(EXPECTED_RADIO_GROUP_EXPORTS);
    expect(Object.keys(RadioGroupEntry).sort()).toEqual([
      'BrutalistRadioGroupIndicator',
      'BrutalistRadioGroupItem',
      'BrutalistRadioGroupRoot',
      'brutalistRadioGroupIndicator',
      'brutalistRadioGroupItem',
      'brutalistRadioGroupRoot',
    ]);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    for (const [name, value] of Object.entries(RadioGroupEntry)) {
      expect(packageValues.get(name)).toBe(value);
    }
    expectTypeOf<HasUnsupportedRootApi>().toEqualTypeOf<false>();
  });

  it.each([
    ['unexpectedRadioGroupExport', { name: 'brutalist-radio-group-extra' }],
    ['unexpectedAlias', BrutalistRadioGroupRoot],
  ])('rejects an unexpected package export %s', (name, value) => {
    const observed = radioGroupExports({ ...BrutalistPackage, [name]: value });
    expect(observed).toHaveProperty(name);
    expect(observed).not.toEqual(EXPECTED_RADIO_GROUP_EXPORTS);
  });

  it('projects the pinned Root column and Item resting surface', async () => {
    // T-BRUTALIST-RADIO-GROUP-0001-CASE-2
    const { root, items } = await mount();

    for (const token of ROOT_SURFACE_TOKENS) {
      expect(styleContains(root, token), token).toBe(true);
    }
    for (const token of ITEM_SURFACE_TOKENS) {
      expect(styleContains(items[0]!.element, token), token).toBe(true);
    }
    for (const token of INDICATOR_SURFACE_TOKENS) {
      expect(styleContains(items[0]!.indicator, token), token).toBe(true);
    }
  });

  it('keeps single selection, roving focus, and accessibility Base-owned', async () => {
    // T-BRUTALIST-RADIO-GROUP-0001-CASE-3
    const { root, items } = await mount({ defaultValue: 'a' });

    expect(root.getAttribute('role')).toBe('radiogroup');
    expect(items[0]!.element.getAttribute('role')).toBe('radio');
    expect(items[0]!.element.getAttribute('aria-checked')).toBe('true');
    expect(items[1]!.element.getAttribute('aria-checked')).toBe('false');
    expect(items[0]!.indicator.getAttribute('aria-checked')).toBe(null);
    expect(root.getExposes().value.get()).toBe('a');

    items[1]!.element.click();
    await settle();
    expect(root.getExposes().value.get()).toBe('b');
    expect(items[0]!.element.getAttribute('aria-checked')).toBe('false');
    expect(items[1]!.element.getAttribute('aria-checked')).toBe('true');
    expect(items[1]!.element.hasAttribute('data-checked')).toBe(true);
    expect(items[0]!.element.hasAttribute('data-checked')).toBe(false);
  });

  it('keeps the Item resting surface while checked and projects focus and disabled only', async () => {
    // T-BRUTALIST-RADIO-GROUP-0001-CASE-4
    const { items } = await mount({ defaultValue: 'a' });

    const selected = items[0]!;
    expect(styleContains(selected.element, 'bg-transparent')).toBe(true);
    expect(styleContains(selected.element, 'border-border')).toBe(true);
    for (const owned of ['bg-main', 'border-main-foreground', 'border-primary']) {
      expect(styleContains(selected.element, owned), owned).toBe(false);
    }

    const matchesSpy = vi.spyOn(selected.element, 'matches').mockReturnValue(true);
    selected.element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await settle();
    expect(selected.element.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(selected.element, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(selected.indicator.hasAttribute('data-focus-visible')).toBe(false);
    matchesSpy.mockRestore();

    setElementProps(items[1]!.element, { value: 'b', disabled: true } as any);
    await settle();
    items[1]!.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(items[1]!.element.getAttribute('aria-disabled')).toBe('true');
    expect(styleContains(items[1]!.element, 'data-[disabled]:opacity-50')).toBe(true);
    expect(styleContains(items[1]!.element, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(items[1]!.element, 'data-[disabled]:cursor-not-allowed')).toBe(true);
  });

  it('derives the Indicator dot without stacking glyphs or interaction ownership', async () => {
    // T-BRUTALIST-RADIO-GROUP-0001-CASE-5
    const { root, items } = await mount();

    const svg = items[0]!.indicator.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('fill')).toBe('currentColor');
    expect(svg?.getAttribute('stroke')).toBe('none');
    expect(items[0]!.indicator.querySelectorAll('svg')).toHaveLength(1);
    expect(styleContains(items[0]!.indicator, 'opacity-0')).toBe(true);
    expect(items[0]!.indicator.hasAttribute('role')).toBe(false);

    items[0]!.element.click();
    await settle();
    expect(styleContains(items[0]!.indicator, 'data-[checked]:opacity-100')).toBe(true);
    expect(items[0]!.indicator.querySelectorAll('svg')).toHaveLength(1);
    expect(items[1]!.indicator.getExposes().isChecked()).toBe(false);
    expect(root.getAttribute('role')).toBe('radiogroup');
  });
});
