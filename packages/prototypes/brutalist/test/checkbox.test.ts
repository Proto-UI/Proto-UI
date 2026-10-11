import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import {
  BrutalistCheckboxIndicator,
  BrutalistCheckboxRoot,
  brutalistCheckboxIndicator,
  brutalistCheckboxRoot,
} from '../src/checkbox';
import * as BrutalistPackage from '../src';
import * as CheckboxEntry from '../src/checkbox';
import * as CheckboxGroupEntry from '../src/checkbox-group';
import type { BrutalistCheckboxRootProps } from '../src/checkbox';

type HasUnsupportedRootApi =
  Extract<
    'variant' | 'size' | 'onCheckedChange' | 'name' | 'value' | 'form',
    keyof BrutalistCheckboxRootProps
  > extends never
    ? false
    : true;

type ExposingElement = HTMLElement & { getExposes(): Record<string, any> };

const ROOT_SURFACE_TOKENS = [
  'flex',
  'h-5',
  'w-5',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-none',
  'border-2',
  'border-border',
  'outline-none',
  'bg-transparent',
  'text-foreground',
  'select-none',
  'transition-none',
];
const INDICATOR_SURFACE_TOKENS = [
  'flex',
  'size-4',
  'items-center',
  'justify-center',
  'text-main-foreground',
  'transition-none',
];
const CHECK_PATH = 'm20 6-11 11-5-5';
const DASH_PATH = 'M5 12h14';

AdaptToWebComponent(BrutalistCheckboxRoot as any);
AdaptToWebComponent(BrutalistCheckboxIndicator as any);

async function settle(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function mount(props: Record<string, unknown> = {}) {
  const root = document.createElement(BrutalistCheckboxRoot.name) as ExposingElement;
  const indicator = document.createElement(BrutalistCheckboxIndicator.name) as ExposingElement;
  setElementProps(root, props as any);
  root.appendChild(indicator);
  document.body.appendChild(root);
  await settle();
  return { root, indicator };
}

function glyphPaths(indicator: HTMLElement): string[] {
  return [...indicator.querySelectorAll('svg path')].map((path) => path.getAttribute('d') ?? '');
}

function prototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

// CheckboxGroup is a separately governed composition, not an extra Checkbox
// anatomy part. Keep the package-wide set exact instead of excluding Group or
// selecting only already-known keys, which could hide new accidental exports.
const EXPECTED_CHECKBOX_EXPORTS = {
  BrutalistCheckboxIndicator: 'brutalist-checkbox-indicator',
  BrutalistCheckboxRoot: 'brutalist-checkbox-root',
  brutalistCheckboxIndicator: 'brutalist-checkbox-indicator',
  brutalistCheckboxRoot: 'brutalist-checkbox-root',
  checkboxGroupAll: 'brutalist-checkbox-group-all',
  checkboxGroupItem: 'brutalist-checkbox-group-item',
  checkboxGroupRoot: 'brutalist-checkbox-group-root',
};

function checkboxExports(entry: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(
        ([name, value]) =>
          name.toLowerCase().includes('checkbox') ||
          prototypeName(value)?.startsWith('brutalist-checkbox-')
      )
      .map(([name, value]) => [name, prototypeName(value)])
  );
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('prototypes/brutalist: checkbox', () => {
  it('exports exactly the admitted Root and Indicator values through family and package entries', () => {
    expect(brutalistCheckboxRoot).toBe(BrutalistCheckboxRoot);
    expect(brutalistCheckboxIndicator).toBe(BrutalistCheckboxIndicator);
    expect(BrutalistCheckboxRoot.name).toBe('brutalist-checkbox-root');
    expect(BrutalistCheckboxIndicator.name).toBe('brutalist-checkbox-indicator');
    expect(checkboxExports(BrutalistPackage)).toEqual(EXPECTED_CHECKBOX_EXPORTS);
    expect(Object.keys(CheckboxEntry).sort()).toEqual([
      'BrutalistCheckboxIndicator',
      'BrutalistCheckboxRoot',
      'brutalistCheckboxIndicator',
      'brutalistCheckboxRoot',
    ]);
    expect(Object.keys(CheckboxGroupEntry).sort()).toEqual([
      'checkboxGroupAll',
      'checkboxGroupItem',
      'checkboxGroupRoot',
    ]);
    const packageValues = new Map(Object.entries(BrutalistPackage));
    for (const [name, value] of Object.entries({ ...CheckboxEntry, ...CheckboxGroupEntry })) {
      expect(packageValues.get(name)).toBe(value);
    }
    expectTypeOf<HasUnsupportedRootApi>().toEqualTypeOf<false>();
  });

  it.each([
    ['unexpectedCheckboxExport', { name: 'brutalist-checkbox-extra' }],
    ['checkboxGroupExtra', { name: 'brutalist-checkbox-group-extra' }],
    ['unexpectedAlias', BrutalistCheckboxRoot],
  ])('rejects an unexpected package export %s', (name, value) => {
    const observed = checkboxExports({ ...BrutalistPackage, [name]: value });
    expect(observed).toHaveProperty(name);
    expect(observed).not.toEqual(EXPECTED_CHECKBOX_EXPORTS);
  });

  it('projects the square resting surface and preserves mixed precedence', async () => {
    const { root, indicator } = await mount();

    for (const token of ROOT_SURFACE_TOKENS) {
      expect(styleContains(root, token), token).toBe(true);
    }
    expect(styleContains(root, 'border-black')).toBe(false);
    for (const token of INDICATOR_SURFACE_TOKENS) {
      expect(styleContains(indicator, token), token).toBe(true);
    }
    expect(root.getAttribute('aria-checked')).toBe('false');
    expect(glyphPaths(indicator)).toEqual([]);

    setElementProps(root, { checked: true } as any);
    await settle();
    expect(styleContains(root, 'data-[checked]:not-[data-indeterminate]:bg-main')).toBe(true);
    expect(
      styleContains(root, 'data-[checked]:not-[data-indeterminate]:text-main-foreground')
    ).toBe(true);
    expect(styleContains(root, 'data-[checked]:not-[data-indeterminate]:border-background')).toBe(
      false
    );
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(glyphPaths(indicator)).toEqual([CHECK_PATH]);

    setElementProps(root, { checked: true, indeterminate: true } as any);
    await settle();
    expect(root.getAttribute('aria-checked')).toBe('mixed');
    expect(styleContains(root, 'data-[indeterminate]:bg-main')).toBe(true);
    expect(styleContains(root, 'data-[indeterminate]:text-main-foreground')).toBe(true);
    expect(styleContains(root, 'border-border')).toBe(true);
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);
  });

  it('uses inherited press, focus-visible, and disabled facts for presentation only', async () => {
    const { root, indicator } = await mount();

    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle();
    expect(root.getExposes().pressed.get()).toBe(true);
    expect(styleContains(root, 'data-[pressed]:shadow-none')).toBe(false);

    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(root, 'matches').mockReturnValue(true);
    root.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await settle();
    expect(root.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(indicator.hasAttribute('data-focus-visible')).toBe(false);
    matchesSpy.mockRestore();

    setElementProps(root, { disabled: true, checked: false, indeterminate: true } as any);
    await settle();
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.getExposes().checked.get()).toBe(false);
    expect(root.getAttribute('aria-disabled')).toBe('true');
    expect(styleContains(root, 'data-[disabled]:opacity-50')).toBe(true);
    expect(styleContains(root, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);
  });

  it('keeps Indicator derived and reuses one accessibility-hidden glyph', async () => {
    const { root, indicator } = await mount();

    expect(Object.keys(indicator.getExposes()).sort()).toEqual([
      'checked',
      'indeterminate',
      'isChecked',
      'isIndeterminate',
    ]);
    expect(Object.keys(root.getExposes()).sort()).toEqual([
      'checked',
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'hovered',
      'indeterminate',
      'pressed',
    ]);
    expect(indicator.hasAttribute('role')).toBe(false);
    expect(indicator.hasAttribute('aria-checked')).toBe(false);
    expect(root.getAttribute('role')).toBe('checkbox');

    for (let index = 0; index < 3; index += 1) {
      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(indicator.querySelectorAll('svg')).toHaveLength(1);
      expect(indicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(indicator.querySelectorAll('svg')).toHaveLength(0);
    }

    setElementProps(indicator, { checked: true, indeterminate: true } as any);
    await settle();
    expect(indicator.getExposes().isChecked()).toBe(false);
    expect(indicator.getExposes().isIndeterminate()).toBe(false);
  });

  it('emits source-aligned colors and glyph CSS while preserving the existing 20px framed hit box', async () => {
    // 16px source geometry remains blocked until a governed hit envelope exists.
    const { root, indicator } = await mount({ checked: true });
    expect(styleContains(root, 'h-5')).toBe(true);
    expect(styleContains(root, 'w-5')).toBe(true);
    expect(styleContains(root, 'size-4')).toBe(false);
    for (const old of ['bg-main', 'outline-2', 'border-main-foreground']) {
      expect(styleContains(root, old), old).toBe(false);
    }
    const svg = indicator.querySelector('svg');
    expect(svg?.getAttribute('stroke-width')).toBe('2');
    expect(svg?.getAttribute('stroke-linecap')).toBe('round');
    expect(svg?.getAttribute('stroke-linejoin')).toBe('round');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    const tokens = [root, indicator].flatMap((el) =>
      (el.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean)
    );
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('border-width: 2px;');
    expect(css).toContain('border-color: var(--pui-border);');
  });
});
