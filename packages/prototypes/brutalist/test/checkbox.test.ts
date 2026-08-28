import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  BrutalistCheckboxRoot as checkboxRoot,
  BrutalistCheckboxIndicator as checkboxIndicator,
} from '../src/checkbox';

type CheckboxRootElement = WebComponentAdapterElement<typeof checkboxRoot>;
type CheckboxIndicatorElement = WebComponentAdapterElement<typeof checkboxIndicator>;

AdaptToWebComponent(checkboxRoot);
AdaptToWebComponent(checkboxIndicator);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function settle(): Promise<void> {
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  await flush();
}

function createCheckbox(props: Record<string, unknown> = {}) {
  const root = document.createElement(checkboxRoot.name) as CheckboxRootElement;
  const indicator = document.createElement(checkboxIndicator.name) as CheckboxIndicatorElement;
  setElementProps(root, props);
  root.appendChild(indicator);
  document.body.appendChild(root);
  return { root, indicator };
}

function glyphPaths(indicator: HTMLElement): string[] {
  return [...indicator.querySelectorAll('svg path')].map((path) => path.getAttribute('d') ?? '');
}

const CHECK_PATH = 'm20 6-11 11-5-5';
const DASH_PATH = 'M5 12h14';

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/brutalist: checkbox', () => {
  it('activates checked fill, press, focus-visible, and disabled rules', async () => {
    const { root } = createCheckbox({ defaultChecked: false });
    await settle();

    expect(root.getExposes().checked.get()).toBe(false);
    expect(styleContains(root, 'bg-main')).toBe(true);
    expect(styleContains(root, 'text-main-foreground')).toBe(true);

    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(root.getExposes().pressed.get()).toBe(true);
    expect(styleContains(root, 'data-[pressed]:shadow-none')).toBe(true);

    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();
    expect(root.getExposes().pressed.get()).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(root, 'matches').mockReturnValue(true);
    root.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(root.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-2')).toBe(true);
    matchesSpy.mockRestore();

    setElementProps(root, { disabled: true });
    await settle();
    expect(root.getExposes().disabled.get()).toBe(true);
    expect(styleContains(root, 'data-[disabled]:opacity-50')).toBe(true);
    expect(styleContains(root, 'data-[disabled]:pointer-events-none')).toBe(true);
  });

  it('indicator visibility and glyph follow checked and indeterminate state', async () => {
    const { root, indicator } = createCheckbox({ defaultChecked: false });
    await settle();

    expect(styleContains(indicator, 'opacity-0')).toBe(true);
    expect(glyphPaths(indicator)).toEqual([]);

    setElementProps(root, { checked: true });
    await settle();
    expect(root.getExposes().checked.get()).toBe(true);
    expect(root.hasAttribute('data-checked')).toBe(true);
    expect(root.hasAttribute('data-indeterminate')).toBe(false);
    expect(styleContains(root, 'data-[checked]:not-[data-indeterminate]:bg-foreground')).toBe(true);
    expect(styleContains(root, 'data-[checked]:not-[data-indeterminate]:text-background')).toBe(
      true
    );
    expect(styleContains(indicator, 'data-[checked]:opacity-100')).toBe(true);
    expect(glyphPaths(indicator)).toEqual([CHECK_PATH]);
    expect(indicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    setElementProps(root, { checked: false, indeterminate: true });
    await settle();
    expect(root.getExposes().checked.get()).toBe(false);
    expect(root.getExposes().indeterminate.get()).toBe(true);
    expect(styleContains(root, 'text-main-foreground')).toBe(true);
    expect(styleContains(indicator, 'data-[indeterminate]:opacity-100')).toBe(true);
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);

    setElementProps(root, { checked: true, indeterminate: true });
    await settle();
    expect(root.getExposes().checked.get()).toBe(true);
    expect(root.getExposes().indeterminate.get()).toBe(true);
    expect(root.hasAttribute('data-checked')).toBe(true);
    expect(root.hasAttribute('data-indeterminate')).toBe(true);
    expect(styleContains(root, 'bg-main')).toBe(true);
    expect(styleContains(root, 'text-main-foreground')).toBe(true);
    expect(styleContains(root, 'data-[checked]:bg-foreground')).toBe(false);
    expect(styleContains(root, 'data-[checked]:text-background')).toBe(false);
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);
    expect(indicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
