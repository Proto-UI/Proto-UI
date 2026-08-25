import { describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  checkboxIndicator,
  checkboxRoot,
  shadcnCheckboxIndicator,
  shadcnCheckboxRoot,
} from '../src/checkbox';

AdaptToWebComponent(checkboxRoot as any);
AdaptToWebComponent(checkboxIndicator as any);

const ROOT_SURFACE_TOKENS = [
  'size-4',
  'shrink-0',
  'rounded-[4px]',
  'border',
  'border-input',
  'bg-transparent',
  'shadow-xs',
  'outline-none',
];

const INDICATOR_SURFACE_TOKENS = [
  'flex',
  'size-3.5',
  'items-center',
  'justify-center',
  'transition-none',
];

/**
 * Web-host lowering of the condition-driven rules. Checked and indeterminate
 * carry the same fill, so the two variants must both be present: an `any`
 * condition would collapse them into one runtime-plan rule and paint the box
 * after the first frame instead of with it.
 */
const WEB_STATE_TOKENS = [
  'data-[checked]:bg-primary',
  'data-[checked]:text-primary-foreground',
  'data-[checked]:border-primary',
  'data-[indeterminate]:bg-primary',
  'data-[indeterminate]:text-primary-foreground',
  'data-[indeterminate]:border-primary',
  'data-[focus-visible]:border-ring',
  'data-[focus-visible]:ring-ring/50',
  'data-[focus-visible]:ring-3',
  'data-[disabled]:cursor-not-allowed',
  'data-[disabled]:opacity-50',
  'dark:not-[data-checked]:not-[data-indeterminate]:bg-input/30',
];

const UNSCOPED_STATE_TOKENS = [
  'bg-primary',
  'border-primary',
  'text-primary-foreground',
  'border-ring',
  'ring-3',
  'cursor-not-allowed',
  'opacity-50',
  'bg-input/30',
];

const CHECK_PATH = 'm20 6-11 11-5-5';
const DASH_PATH = 'M5 12h14';

type ExposingElement = HTMLElement & { getExposes(): Record<string, any> };

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mount(props: Record<string, unknown> = {}): Promise<{
  root: ExposingElement;
  indicator: ExposingElement;
}> {
  const root = document.createElement('shadcn-checkbox-root') as ExposingElement;
  const indicator = document.createElement('shadcn-checkbox-indicator') as ExposingElement;
  setElementProps(root, props as any);
  root.appendChild(indicator);
  document.body.appendChild(root);
  await flush();
  return { root, indicator };
}

function glyphPaths(indicator: HTMLElement): string[] {
  return [...indicator.querySelectorAll('svg path')].map((path) => path.getAttribute('d') ?? '');
}

describe('prototypes/shadcn: checkbox', () => {
  it('exposes Root and Indicator through exact package entries', () => {
    // T-SHADCN-CHECKBOX-0001-CASE-EXPORTS
    expect(shadcnCheckboxRoot).toBe(checkboxRoot);
    expect(shadcnCheckboxIndicator).toBe(checkboxIndicator);
    expect(checkboxRoot.name).toBe('shadcn-checkbox-root');
    expect(checkboxIndicator.name).toBe('shadcn-checkbox-indicator');
  });

  it('projects the resting box and paints no glyph before any state', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-DEFAULT
    const { root, indicator } = await mount();

    for (const token of ROOT_SURFACE_TOKENS) {
      expect(styleContains(root, token), `${token} :: ${root.getAttribute('data-pui-style')}`).toBe(
        true
      );
    }
    for (const token of INDICATOR_SURFACE_TOKENS) {
      expect(
        styleContains(indicator, token),
        `${token} :: ${indicator.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    expect(root.getAttribute('aria-checked')).toBe('false');
    expect(root.hasAttribute('data-checked')).toBe(false);
    expect(glyphPaths(indicator)).toEqual([]);

    root.remove();
  });

  it('fills the box and paints the tick once activation checks it', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-CHECKED
    const { root, indicator } = await mount();

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(root.getExposes().checked.get()).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(root.hasAttribute('data-checked')).toBe(true);
    expect(indicator.hasAttribute('data-checked')).toBe(true);
    expect(glyphPaths(indicator)).toEqual([CHECK_PATH]);
    // The Root already carries the role and the checked state, so the glyph
    // would only add an unnamed node to the accessibility tree.
    expect(indicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    root.remove();
  });

  it('fills the box and paints the dash while the value is mixed', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-INDETERMINATE
    const { root, indicator } = await mount({ defaultIndeterminate: true });

    expect(root.getExposes().indeterminate.get()).toBe(true);
    expect(root.getExposes().checked.get()).toBe(false);
    expect(root.getAttribute('aria-checked')).toBe('mixed');
    expect(root.hasAttribute('data-indeterminate')).toBe(true);
    expect(indicator.getExposes().isIndeterminate()).toBe(true);
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);

    root.remove();
  });

  it('keeps the mixed glyph when checked and indeterminate are both true', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-MIXED-PRECEDENCE
    const { root, indicator } = await mount({
      defaultChecked: true,
      defaultIndeterminate: true,
    });

    expect(root.getExposes().checked.get()).toBe(true);
    expect(root.getExposes().indeterminate.get()).toBe(true);
    // Base resolves the accessible state to mixed, and the glyph follows it.
    expect(root.getAttribute('aria-checked')).toBe('mixed');
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);

    root.remove();
  });

  it('disabled checkbox keeps its mixed value and rejects activation and focus', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-DISABLED
    const { root, indicator } = await mount({ disabled: true, defaultIndeterminate: true });

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(root.getExposes().checked.get()).toBe(false);
    expect(root.getExposes().indeterminate.get()).toBe(true);
    expect(root.hasAttribute('data-disabled')).toBe(true);
    expect(root.getAttribute('aria-disabled')).toBe('true');
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);

    root.getExposes().focusSelf();
    await flush();
    expect(root.getExposes().focused.get()).toBe(false);

    root.remove();
  });

  it('lowers the focus-visible ring onto the Root alone', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-FOCUS-VISIBLE
    const { root, indicator } = await mount();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(root, 'matches').mockReturnValue(true);
    root.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();

    expect(root.getExposes().focusVisible.get()).toBe(true);
    expect(root.hasAttribute('data-focus-visible')).toBe(true);
    expect(indicator.hasAttribute('data-focus-visible')).toBe(false);

    root.remove();
  });

  it('lowers every state rule to conditional web presentation', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-WEB-STATE-EVIDENCE
    const { root } = await mount();

    for (const token of WEB_STATE_TOKENS) {
      expect(styleContains(root, token), `${token} :: ${root.getAttribute('data-pui-style')}`).toBe(
        true
      );
    }
    // The conditional tokens must not also appear unscoped, which would fill and
    // ring the box at rest.
    for (const token of UNSCOPED_STATE_TOKENS) {
      expect(styleContains(root, token), `unscoped ${token}`).toBe(false);
    }
    // The dark tint is for the unfilled box. Unguarded it would also land on the
    // filled box, where the fill and the tint then race on rule order.
    expect(styleContains(root, 'dark:bg-input/30')).toBe(false);

    root.remove();
  });

  it('keeps the Indicator derived, with no focus, event, or value ownership', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-NO-SECOND-OWNER
    const { root, indicator } = await mount();

    // Portable absence: the Indicator publishes no focus handle, no request to
    // move focus, and no way to write the value it derives.
    expect(Object.keys(indicator.getExposes()).sort()).toEqual([
      'checked',
      'indeterminate',
      'isChecked',
      'isIndeterminate',
    ]);
    // Accessibility control syntax stays with the Root.
    expect(indicator.hasAttribute('role')).toBe(false);
    expect(indicator.hasAttribute('aria-checked')).toBe(false);
    expect(root.getAttribute('role')).toBe('checkbox');

    // The Root gains no second value, event, or activation owner either.
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

    // Writing the derived names on the Indicator changes nothing: only the Root
    // context can move them.
    setElementProps(indicator, { checked: true, indeterminate: true } as any);
    await flush();
    expect(indicator.getExposes().isChecked()).toBe(false);
    expect(indicator.getExposes().isIndeterminate()).toBe(false);

    root.remove();
  });

  it('mounts exactly one glyph across repeated updates', async () => {
    // T-SHADCN-CHECKBOX-0001-CASE-GLYPH-IDENTITY
    const { root, indicator } = await mount();

    for (let index = 0; index < 3; index += 1) {
      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(indicator.querySelectorAll('svg'), `checked round ${index}`).toHaveLength(1);

      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(indicator.querySelectorAll('svg'), `unchecked round ${index}`).toHaveLength(0);
    }

    // Switching glyphs must reuse the same element rather than stack a second.
    setElementProps(root, { indeterminate: true } as any);
    await flush();
    expect(glyphPaths(indicator)).toEqual([DASH_PATH]);

    root.remove();
  });
});
