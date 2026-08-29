import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { switchRoot, switchThumb } from '../src/switch';

type SwitchRootElement = WebComponentAdapterElement<typeof switchRoot>;
type SwitchThumbElement = WebComponentAdapterElement<typeof switchThumb>;

AdaptToWebComponent(switchRoot);
AdaptToWebComponent(switchThumb);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function createSwitch(props: Record<string, unknown> = {}) {
  const root = document.createElement(switchRoot.name) as SwitchRootElement;
  const thumb = document.createElement(switchThumb.name) as SwitchThumbElement;
  setElementProps(root, props);
  root.appendChild(thumb);
  document.body.appendChild(root);
  return { root, thumb };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/brutalist: switch', () => {
  it('projects named Root and Thumb entries over Base Switch state', async () => {
    // T-BRUTALIST-SWITCH-0001-CASE-1
    const { root, thumb } = createSwitch();
    await flush();

    expect(switchRoot.name).toBe('brutalist-switch-root');
    expect(switchThumb.name).toBe('brutalist-switch-thumb');
    expect(root.getAttribute('role')).toBe('switch');
    expect(root.getAttribute('aria-checked')).toBe('false');
    expect(root.getExposes().checked.get()).toBe(false);
    expect(thumb.getExposes().isChecked()).toBe(false);

    root.click();
    await flush();
    expect(root.getExposes().checked.get()).toBe(true);
    expect(thumb.getExposes().isChecked()).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(root.hasAttribute('data-checked')).toBe(true);
    expect(thumb.hasAttribute('data-checked')).toBe(true);
  });

  it('keeps symmetric Root padding while Thumb owns checked travel', async () => {
    // T-BRUTALIST-SWITCH-0001-CASE-2
    const { root, thumb } = createSwitch();
    await flush();

    expect(styleContains(root, 'px-0.5')).toBe(true);
    expect(styleContains(root, 'pl-0.5')).toBe(false);
    expect(styleContains(root, 'pr-5')).toBe(false);
    expect(styleContains(thumb, 'translate-x-0')).toBe(true);

    root.click();
    await flush();

    expect(root.getExposes().checked.get()).toBe(true);
    expect(thumb.getExposes().isChecked()).toBe(true);
    expect(styleContains(root, 'px-0.5')).toBe(true);
    expect(styleContains(root, 'data-[checked]:pl-5')).toBe(false);
    expect(styleContains(root, 'data-[checked]:pr-0.5')).toBe(false);
    expect(styleContains(thumb, 'data-[checked]:translate-x-5')).toBe(true);
    expect(styleContains(thumb, 'data-[checked]:bg-canary')).toBe(true);
  });

  it('changes checked fill without changing track geometry', async () => {
    // T-BRUTALIST-SWITCH-0001-CASE-3
    const { root, thumb } = createSwitch({ defaultChecked: true });
    await flush();

    expect(root.getExposes().checked.get()).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(thumb.getExposes().isChecked()).toBe(true);
    expect(styleContains(root, 'data-[checked]:bg-sky')).toBe(true);
    expect(styleContains(thumb, 'data-[checked]:bg-canary')).toBe(true);
    for (const token of ['h-7', 'w-12', 'px-0.5']) expect(styleContains(root, token)).toBe(true);
  });

  it('activates press and focus rules and gates disabled changes', async () => {
    // T-BRUTALIST-SWITCH-0001-CASE-4
    const { root, thumb } = createSwitch();
    await flush();

    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(root.getExposes().pressed.get()).toBe(true);
    expect(root.hasAttribute('data-pressed')).toBe(true);
    expect(styleContains(root, 'data-[pressed]:bg-coral')).toBe(true);
    expect(styleContains(root, 'data-[pressed]:shadow-none')).toBe(true);
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();
    expect(root.getExposes().pressed.get()).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(root, 'matches').mockReturnValue(true);
    root.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(root.getExposes().focusVisible.get()).toBe(true);
    expect(root.hasAttribute('data-focus-visible')).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-ring')).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-offset-2')).toBe(true);

    setElementProps(root, { disabled: true });
    await flush();
    const checkedBefore = root.getExposes().checked.get();
    root.click();
    await flush();
    expect(root.getExposes().disabled.get()).toBe(true);
    expect(root.getAttribute('aria-disabled')).toBe('true');
    expect(root.hasAttribute('data-disabled')).toBe(true);
    expect(root.getExposes().checked.get()).toBe(checkedBefore);
    expect(thumb.getExposes().isChecked()).toBe(checkedBefore);
    expect(styleContains(root, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(root, 'data-[disabled]:opacity-50')).toBe(true);
  });

  it('keeps square, black-bordered, hard-shadow grammar on Root and Thumb', async () => {
    // T-BRUTALIST-SWITCH-0001-CASE-5
    const { root, thumb } = createSwitch();
    await flush();

    for (const token of [
      'h-7',
      'w-12',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-secondary-background',
      'shadow-[3px_3px_0_0_#000]',
    ]) {
      expect(styleContains(root, token)).toBe(true);
    }
    for (const token of [
      'block',
      'size-5',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-foreground',
      'shadow-[3px_3px_0_0_#000]',
    ]) {
      expect(styleContains(thumb, token)).toBe(true);
    }
    for (const forbidden of ['rounded-full', 'shadow-md', 'backdrop-blur']) {
      expect(styleContains(root, forbidden)).toBe(false);
      expect(styleContains(thumb, forbidden)).toBe(false);
    }
  });
});
