import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';
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

describe('prototypes/shadcn: switch', () => {
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
    expect(styleContains(thumb, 'transition-transform')).toBe(false);
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
    expect(styleContains(root, 'relative')).toBe(false);
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
      expect(styleContains(thumb, checked ? 'bg-primary-foreground' : 'bg-foreground')).toBe(true);
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
