import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';
import { switchRoot as baseRoot, switchThumb as baseThumb } from '../../base/src/switch';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
const recipeSheet = document.createElement('style');
beforeAll(() => {
  recipeSheet.textContent = renderProtoStyleTokenCss(['relative', 'inline-flex'])
    .replace('@layer proto-ui {', '')
    .replace(/}\s*$/, '');
  document.head.append(recipeSheet);
});
afterAll(() => recipeSheet.remove());

AdaptToWebComponent(switchRoot as any);
AdaptToWebComponent(switchThumb as any);
AdaptToWebComponent(baseRoot as any);
AdaptToWebComponent(baseThumb as any);
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const makeRoot = (size?: 'default' | 'sm', name = 'shadcn-switch-root') => {
  const root = document.createElement(name) as any;
  if (size !== undefined) setElementProps(root, { size });
  return root;
};
const makeThumb = () => document.createElement('shadcn-switch-thumb') as any;
// Selector/declaration evidence on the real host, not native computed paint.
// A lowered dark/state token remains installed in both light and dark themes.
// HappyDOM's element.matches cannot tokenize literal `]` inside a quoted ~= value
// (spec-valid CSS; browsers parse it), so the probe value is escaped to the
// equivalent `\]`/`\[` form for the environment engine only.
function envMatches(target: Element, selector: string): boolean {
  const escaped = selector.replace(
    /\[data-pui-style~="([^"]+)"\]/g,
    (_all, value: string) =>
      `[data-pui-style~="${value.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}"]`
  );
  return target.matches(escaped);
}
function matchingBackgrounds(target: Element) {
  const tokens = (target.getAttribute('data-pui-style') ?? '').split(/\s+/);
  return [...renderProtoStyleTokenCss(tokens).matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .filter(([, selectors, body]) =>
      body.includes('background-color:') &&
      selectors.split(',\n').some((selector) => {
        const required = /\[data-pui-style~="([^"]+)"\]/.exec(selector)?.[1];
        return !!required && tokens.includes(required) && envMatches(target, selector.trim());
      })
    )
    .flatMap(([, , body]) => [...body.matchAll(/background-color:\s*([^;]+);/g)].map((m) => m[1]));
}
const expectSize = (thumb: Element, size: 'default' | 'sm') => {
  expect(styleContains(thumb, size === 'sm' ? 'size-3' : 'size-4')).toBe(true);
  expect(styleContains(thumb, size === 'sm' ? 'size-4' : 'size-3')).toBe(false);
};

describe('prototypes/shadcn: switch', () => {
  it.each(['default', 'sm'] as const)(
    'initial %s size preserves value and sizes every Thumb',
    async (size) => {
      const root = makeRoot(size),
        a = makeThumb(),
        b = makeThumb();
      const changes: unknown[] = [];
      root.addEventListener('checkedChange', (event: CustomEvent) => changes.push(event.detail));
      root.append(a, b);
      document.body.append(root);
      await settle();
      expect(root.getExposes().getVisualSize()).toBe(size);
      expect(styleContains(root, size === 'sm' ? 'h-3.5' : 'h-[1.15rem]')).toBe(true);
      expect(styleContains(root, size === 'sm' ? 'w-6' : 'w-8')).toBe(true);
      expectSize(a, size);
      expectSize(b, size);
      expect(root.getExposes().checked.get()).toBe(false);
      expect(changes).toEqual([]);
      root.remove();
      await settle();
    }
  );

  it('uses the default for an initially invalid size', async () => {
    const root = makeRoot(),
      thumb = makeThumb();
    setElementProps(root, { size: 'unknown' });
    root.append(thumb);
    document.body.append(root);
    await settle();
    expectSize(thumb, 'default');
    expect(root.getExposes().getVisualSize()).toBe('default');
    root.remove();
    await settle();
  });

  it('updates default → sm → default without value events or competing dimensions', async () => {
    const root = makeRoot(),
      thumb = makeThumb();
    root.append(thumb);
    document.body.append(root);
    await settle();
    root.click();
    await settle();
    const changes: unknown[] = [];
    root.addEventListener('checkedChange', (event: CustomEvent) => changes.push(event.detail));
    for (const size of ['sm', 'default', 'sm', undefined] as const) {
      setElementProps(root, size === undefined ? {} : { size });
      await settle();
      const expected = size ?? 'default';
      expect(
        styleContains(thumb, expected === 'sm' ? 'size-3' : 'size-4'),
        `size=${size} root=${root.getExposes().getVisualSize()} tokens=${thumb.getAttribute('data-pui-style')}`
      ).toBe(true);
      expect(root.getExposes().getVisualSize()).toBe(expected);
      expect(styleContains(root, expected === 'sm' ? 'w-8' : 'w-6')).toBe(false);
      expect(styleContains(root, expected === 'sm' ? 'h-[1.15rem]' : 'h-3.5')).toBe(false);
      expect(root.getExposes().checked.get()).toBe(true);
      expect(thumb.getExposes().isChecked()).toBe(true);
      expect(styleContains(thumb, 'translate-x-[calc(100%_-_2px)]')).toBe(true);
    }
    setElementProps(root, { size: 'sm' });
    await settle();
    for (const size of [undefined, 'unknown']) {
      setElementProps(root, { size });
      await settle();
      expectSize(thumb, 'sm');
      expect(root.getExposes().getVisualSize()).toBe('sm');
    }
    setElementProps(root, {});
    await settle();
    expectSize(thumb, 'default');
    expect(changes).toEqual([]);
    root.remove();
    await settle();
  });

  it('isolates nested and sibling Shadcn domains and intervening Base Roots', async () => {
    const outer = makeRoot('sm'),
      inner = makeRoot('default'),
      base = makeRoot(undefined, 'base-switch-root'),
      sibling = makeRoot('default');
    const outerThumb = makeThumb(),
      innerThumb = makeThumb(),
      baseOwned = makeThumb(),
      siblingThumb = makeThumb();
    const neutral = document.createElement('base-switch-thumb');
    outer.append(outerThumb, neutral, inner);
    inner.append(innerThumb, base);
    base.append(baseOwned);
    sibling.append(siblingThumb);
    document.body.append(outer, sibling);
    await settle();
    expectSize(outerThumb, 'sm');
    expectSize(innerThumb, 'default');
    expectSize(baseOwned, 'default');
    expectSize(siblingThumb, 'default');
    expect(styleContains(neutral, 'size-3')).toBe(false);
    expect(base.getExposes().getVisualSize).toBeUndefined();
    setElementProps(inner, { size: 'sm' });
    setElementProps(outer, { size: 'default' });
    await settle();
    expectSize(innerThumb, 'sm');
    expectSize(outerThumb, 'default');
    expectSize(baseOwned, 'default');
    setElementProps(outer, { size: 'sm' });
    await settle();
    expectSize(baseOwned, 'default');
    expectSize(siblingThumb, 'default');
    outer.remove();
    sibling.remove();
    await settle();
  });

  it('reparents live Thumbs using current owner and ignores old outer visual invalidations', async () => {
    const outer = makeRoot('sm'),
      small = makeRoot('sm'),
      base = makeRoot(undefined, 'base-switch-root'),
      thumb = makeThumb();
    outer.append(base, thumb);
    document.body.append(outer, small);
    await settle();
    expectSize(thumb, 'sm');
    base.append(thumb);
    await settle();
    expectSize(thumb, 'default');
    for (const size of ['default', 'sm'] as const) {
      setElementProps(outer, { size });
      await settle();
      expectSize(thumb, 'default');
    }
    small.append(thumb);
    await settle();
    expectSize(thumb, 'sm');
    setElementProps(small, { size: 'default' });
    await settle();
    expectSize(thumb, 'default');
    outer.remove();
    small.remove();
    await settle();
  });

  it('raw composition permits omitted and replacement parts without a second size owner', async () => {
    const root = makeRoot('sm');
    document.body.append(root);
    await settle();
    expect(root.children).toHaveLength(0);
    expect(root.getExposes().getVisualSize()).toBe('sm');
    const first = makeThumb();
    root.append(first);
    await settle();
    expectSize(first, 'sm');
    const replacement = makeThumb();
    first.replaceWith(replacement);
    await settle();
    expectSize(replacement, 'sm');
    replacement.remove();
    await settle();
    setElementProps(root, { size: 'default' });
    await settle();
    const restored = makeThumb();
    root.append(restored);
    await settle();
    expectSize(restored, 'default');
    root.remove();
    await settle();
  });
  it('keeps root and thumb as named direct entries', () => {
    expect(switchRoot.name).toBe('shadcn-switch-root');
    expect(switchThumb.name).toBe('shadcn-switch-thumb');
  });

  it('runs as a compound switch and keeps thumb attached to root state', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    root.appendChild(thumb);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().checked.get()).toBe(false);
    expect(thumb.getExposes().isChecked()).toBe(false);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(root.getExposes().checked.get()).toBe(true);
    expect(thumb.getExposes().isChecked()).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(styleContains(root, 'bg-primary')).toBe(true);
    expect(styleContains(root, 'p-0')).toBe(true);
    expect(styleContains(root, 'data-[checked]:pl-5')).toBe(false);
    expect(styleContains(thumb, 'size-4')).toBe(true);
    expect(styleContains(thumb, 'translate-x-0')).toBe(false);
    expect(styleContains(thumb, 'ring-offset-0')).toBe(true);
    expect(styleContains(thumb, 'translate-x-[calc(100%_-_2px)]')).toBe(true);
    expect(thumb.hasAttribute('data-checked')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('keeps upstream sizing while retaining Base hover and press without extra family paint', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    root.appendChild(thumb);
    document.body.appendChild(root);
    for (let i = 0; i < 6; i++) await Promise.resolve();
    for (const token of ['h-[1.15rem]', 'w-8', 'p-0', 'rounded-full', 'bg-input', 'shadow-xs']) {
      expect(styleContains(root, token)).toBe(true);
    }
    for (const token of [
      'h-6',
      'w-11',
      'px-0.5',
      'h-[18.4px]',
      'w-[32px]',
      'duration-200',
      'ring-offset-2',
      'scale-[0.98]',
    ]) {
      const authoredUtilities = (root.getAttribute('data-pui-style') ?? '')
        .split(/\s+/)
        .map((value: string) => value.slice(value.lastIndexOf(':') + 1));
      expect(authoredUtilities).not.toContain(token);
    }
    expect(styleContains(thumb, 'transition-transform')).toBe(true);
    expect(styleContains(thumb, 'border')).toBe(false);
    expect(styleContains(thumb, 'shadow-lg')).toBe(false);
    for (const checked of [false, true]) {
      if (root.getExposes().checked.get() !== checked)
        root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 3; i++) await Promise.resolve();
      const expectedPaint = checked ? 'bg-primary' : 'bg-input';
      const assertPaint = () => {
        const tokens = (root.getAttribute('data-pui-style') ?? '').split(/\s+/);
        const utilities = tokens.map((value: string) => value.slice(value.lastIndexOf(':') + 1));
        expect(tokens.filter((value: string) => /hover|press/.test(value))).toEqual([]);
        expect(utilities.filter((value: string) => value.startsWith('bg-'))).toEqual([
          expectedPaint,
        ]);
        expect(utilities.some((value: string) => value.startsWith('scale-'))).toBe(false);
      };
      assertPaint();
      root.dispatchEvent(
        new PointerEvent('pointerenter', { bubbles: true, pointerId: 1, pointerType: 'mouse' })
      );
      await Promise.resolve();
      expect(root.getExposes().hovered.get()).toBe(true);
      assertPaint();
      root.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
        })
      );
      await Promise.resolve();
      expect(root.getExposes().pressed.get()).toBe(true);
      assertPaint();
      root.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, pointerId: 1, pointerType: 'mouse' })
      );
      await Promise.resolve();
      expect(root.getExposes().pressed.get()).toBe(false);
      expect(root.getExposes().hovered.get()).toBe(false);
      expect(root.getExposes().checked.get()).toBe(checked);
      assertPaint();
    }
    root.remove();
  });

  it('emits source rem dimensions rather than the root-16 pixel coincidence', () => {
    const css = renderProtoStyleTokenCss(['h-[1.15rem]', 'w-8', 'size-4']);
    expect(css).toMatch(/height:\s*1\.15rem/);
    expect(css).toMatch(/width:\s*2rem/);
    expect(css).not.toMatch(/height:\s*18\.4px|width:\s*32px/);
  });

  it('does not acquire the old Nova pseudo-element hit envelope', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    document.body.append(root);
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(root.getAttribute('style') ?? '').not.toContain('static-hit');
    expect(root.getAttribute('data-pui-static-hit')).toBeNull();
    // A persistent positioning box permits scope-driven hit lease acquisition.
    // NY still owns no inset or generated hit marker.
    expect(styleContains(root, 'relative')).toBe(true);
    root.remove();
  });

  it('applies focus-visible ring styles when keyboard focus reaches the root', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    root.appendChild(thumb);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(root, 'ring-3')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(root, 'matches').mockReturnValue(true);
    root.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await Promise.resolve();

    expect(root.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(root, 'ring-3')).toBe(true);
    expect(styleContains(root, 'ring-ring/50')).toBe(true);
    expect(styleContains(root, 'border-ring')).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-offset-2')).toBe(false);
    expect(thumb.hasAttribute('data-focus-visible')).toBe(false);

    matchesSpy.mockRestore();
    root.remove();
    await Promise.resolve();
  });

  it('controlled refusal keeps the same final targets across repeated clicks', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    const changes: unknown[] = [];
    root.addEventListener('checkedChange', (event: CustomEvent) => changes.push(event.detail));
    setElementProps(root, { checked: false });
    root.append(thumb);
    document.body.append(root);
    for (let i = 0; i < 6; i++) await Promise.resolve();
    const beforeRoot = root.getAttribute('data-pui-style'),
      beforeThumb = thumb.getAttribute('data-pui-style');
    for (let i = 0; i < 3; i++) {
      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    }
    expect(changes).toEqual([{ checked: true }, { checked: true }, { checked: true }]);
    expect(root.getExposes().checked.get()).toBe(false);
    expect(thumb.getExposes().isChecked()).toBe(false);
    expect(root.getAttribute('data-pui-style')).toBe(beforeRoot);
    expect(thumb.getAttribute('data-pui-style')).toBe(beforeThumb);
    expect(styleContains(root, 'bg-input')).toBe(true);
    root.remove();
  });

  it.each([false, true])('preserves dark source paint with checked=%s', async (checked) => {
    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'dark';
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    try {
      setElementProps(root, { checked });
      root.append(thumb);
      document.body.append(root);
      for (let i = 0; i < 8; i++) await Promise.resolve();
      expect(styleContains(root, checked ? 'bg-primary' : 'bg-input/80')).toBe(true);
      expect(matchingBackgrounds(thumb)).toContain(
        checked ? 'var(--pui-primary-foreground)' : 'var(--pui-foreground)'
      );
      expect(root.getAttribute('role')).toBe('switch');
      expect(root.getAttribute('aria-checked')).toBe(String(checked));
      expect(thumb.hasAttribute('role')).toBe(false);
    } finally {
      root.remove();
      if (previousTheme === undefined) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = previousTheme;
    }
  });

  it('disabled shadcn switch suppresses checked changes', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    setElementProps(root, { disabled: true, defaultChecked: false });
    root.appendChild(thumb);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.getExposes().checked.get()).toBe(false);
    expect(thumb.getExposes().isChecked()).toBe(false);
    expect(root.hasAttribute('data-disabled')).toBe(true);
    for (const token of ['pointer-events-none', 'opacity-50', 'cursor-not-allowed']) {
      expect(styleContains(root, token)).toBe(true);
    }

    root.remove();
    await Promise.resolve();
  });
});
