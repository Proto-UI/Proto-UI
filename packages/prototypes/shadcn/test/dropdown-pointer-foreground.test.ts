import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dropdownContent, dropdownItem, dropdownRoot, dropdownShortcut } from '../src/dropdown';
import { SHADCN_STYLE_IDS } from '../src/style-scope';
import { styleContains } from '../../test-utils/style';

const Root = AdaptToWebComponent(dropdownRoot, { register: false });
const Content = AdaptToWebComponent(dropdownContent, { register: false });
const Item = AdaptToWebComponent(dropdownItem, { register: false });
const Shortcut = AdaptToWebComponent(dropdownShortcut, { register: false });
customElements.define('dropdown-pointer-foreground-root', Root);
customElements.define('dropdown-pointer-foreground-content', Content);
customElements.define('dropdown-pointer-foreground-item', Item);
customElements.define('dropdown-pointer-foreground-shortcut', Shortcut);

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  for (let index = 0; index < 15; index++) await Promise.resolve();
}
afterEach(async () => {
  document.body.replaceChildren();
  document.documentElement.classList.remove('dark');
  await settle();
  vi.useRealTimers();
});

// Upstream style-*.css at shadcn-ui/ui 3d98900 maps focus to the foreground
// and accent surface; the passive Shortcut follows its Item. We assert source
// transport, not native computed color or exact upstream pixel equivalence.
it.each(SHADCN_STYLE_IDS)(
  '%s moves foreground, background and passive shortcut off the old focus row',
  async (styleProfile) => {
    vi.useFakeTimers();
    const root = new Root();
    setElementProps(root, { defaultOpen: true, styleProfile });
    const content = new Content();
    setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
    const shortcuts: InstanceType<typeof Shortcut>[] = [];
    const items = ['Profile', 'Billing', 'Delete', 'API'].map((label, index) => {
      const item = new Item();
      setElementProps(item, {
        value: label,
        textValue: label,
        variant: index === 2 ? 'destructive' : 'default',
        disabled: index === 3,
      });
      const shortcut = new Shortcut();
      shortcut.textContent = '⌘P';
      shortcuts.push(shortcut);
      item.append(label, shortcut);
      content.append(item);
      return item;
    });
    root.append(content);
    document.body.append(root);
    await settle();
    expect(document.activeElement).toBe(items[0]);
    expect(styleContains(items[0], 'text-accent-foreground')).toBe(true);
    const move = async (index: number) => {
      for (const [otherIndex, item] of items.entries()) {
        if (otherIndex !== index) item.dispatchEvent(new PointerEvent('pointerleave'));
      }
      items[index].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      items[index].dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', buttons: 0 })
      );
      await settle();
    };
    await move(1);
    expect(document.activeElement).toBe(items[1]);
    for (const token of ['bg-accent', 'text-accent-foreground']) {
      expect(styleContains(items[0], token)).toBe(false);
      expect(styleContains(items[1], token)).toBe(true);
    }
    // Shortcut foreground lowers to a data-[active] variant: the static token
    // is wired once and the data-active attribute follows the observed state.
    expect(styleContains(shortcuts[1], 'data-[active]:text-accent-foreground')).toBe(true);
    expect(shortcuts[0].hasAttribute('data-active')).toBe(false);
    expect(shortcuts[1].hasAttribute('data-active')).toBe(true);
    // Keep the mouse physically over Billing while the keyboard selects Home.
    // Injecting pointerleave here would hide New York's stale-hover regression.
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await settle();
    expect(items[1].getExposes().hovered.get()).toBe(true);
    expect(document.activeElement).toBe(items[0]);
    expect(styleContains(items[0], 'text-accent-foreground')).toBe(true);
    expect(styleContains(items[1], 'text-accent-foreground')).toBe(false);
    expect(shortcuts[1].hasAttribute('data-active')).toBe(false);
    items[1].dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', buttons: 0 })
    );
    await settle();
    expect(document.activeElement).toBe(items[1]);
    expect(styleContains(items[0], 'text-accent-foreground')).toBe(false);
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark);
      await move(2);
      expect(document.activeElement).toBe(items[2]);
      expect(styleContains(items[2], 'text-destructive')).toBe(true);
      expect(styleContains(items[2], `bg-destructive/${dark ? 20 : 10}`)).toBe(true);
      expect(styleContains(items[2], 'text-accent-foreground')).toBe(false);
      expect(styleContains(items[1], 'text-accent-foreground')).toBe(false);
      items[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await settle();
      expect(items[2].getExposes().hovered.get()).toBe(true);
      expect(styleContains(items[2], 'text-destructive')).toBe(true);
      expect(styleContains(items[2], 'bg-destructive/10')).toBe(false);
      expect(styleContains(items[2], 'bg-destructive/20')).toBe(false);
      await move(1);
    }
    await move(3);
    expect(document.activeElement).toBe(items[1]);
    expect(styleContains(items[3], 'text-accent-foreground')).toBe(false);
    // Disabled paint lowers to the data-[disabled] variant with the data-active
    // hand-off asserted above; the token pair is wired, the attribute follows state.
    expect(styleContains(items[3], 'data-[disabled]:opacity-50')).toBe(true);
    expect(items[3].hasAttribute('data-disabled')).toBe(true);
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await settle();
    expect(document.activeElement).toBe(items[0]);
    expect(styleContains(items[0], 'text-accent-foreground')).toBe(true);
    expect(styleContains(items[1], 'text-accent-foreground')).toBe(false);
  }
);
