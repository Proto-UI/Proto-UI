import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as contextMenu from '../../src/context-menu';
import * as menubar from '../../src/menubar';
import * as navigation from '../../src/navigation-menu';
import * as shadcnContextMenu from '../../../shadcn/src/context-menu';
import * as shadcnNavigation from '../../../shadcn/src/navigation-menu';
import * as brutalistNavigation from '../../../brutalist/src/navigation-menu';
import * as bootstrapNavigation from '../../../bootstrap-2-3-2/src/navigation-menu';
import * as liquidNavigation from '../../../liquid-glass/src/navigation-menu';

const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };

for (const mod of [
  contextMenu,
  menubar,
  navigation,
  shadcnContextMenu,
  shadcnNavigation,
  brutalistNavigation,
  bootstrapNavigation,
  liquidNavigation,
]) {
  for (const proto of Object.values(mod)) {
    if (proto && typeof proto === 'object' && 'name' in proto && 'setup' in proto) {
      AdaptToWebComponent(proto as any, {
        diagnostics: {
          onLifecycleEvent(event) {
            if (event.type === 'instance.created') lives.created++;
            if (event.type === 'instance.dispose.done') lives.disposed++;
          },
        },
      });
    }
  }
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

const tokens = (el: Element) =>
  new Set((el.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean));

function make(name: string, props: Record<string, unknown> = {}): any {
  const el = document.createElement(name);
  setElementProps(el, props);
  owned.add(el);
  return el;
}

function mouseMove(target: Element, init: Partial<PointerEventInit> = {}): PointerEvent {
  const event = new PointerEvent('pointermove', {
    bubbles: true,
    cancelable: true,
    pointerType: 'mouse',
    buttons: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function mouseEnter(target: Element, init: Partial<PointerEventInit> = {}): PointerEvent {
  const event = new PointerEvent('pointerenter', {
    bubbles: false,
    cancelable: true,
    pointerType: 'mouse',
    buttons: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(async () => {
  for (const el of owned) el.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
});

describe('menu pointer-focus handoff', () => {
  it('context-menu hands off Focus and active from initial item to hovered mouse item without double highlight', async () => {
    const root = make(shadcnContextMenu.contextMenuRoot.name);
    const trigger = make(shadcnContextMenu.contextMenuTrigger.name);
    const content = make(shadcnContextMenu.contextMenuContent.name, {
      enterDuration: 0,
      leaveDuration: 0,
    });
    const first = make(shadcnContextMenu.contextMenuItem.name, { value: 'back' });
    const second = make(shadcnContextMenu.contextMenuItem.name, { value: 'reload' });
    const unvalued = make(shadcnContextMenu.contextMenuItem.name);
    const disabledItem = make(shadcnContextMenu.contextMenuItem.name, {
      value: 'disabled',
      disabled: true,
    });
    trigger.textContent = 'Target';
    first.textContent = 'Back';
    second.textContent = 'Reload';
    unvalued.textContent = 'Plain';
    disabledItem.textContent = 'Disabled';
    content.append(first, second, unvalued, disabledItem);
    root.append(trigger, content);
    document.body.append(root);
    await flush();

    trigger.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
    );
    await flush();

    expect(root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(first.getExposes().active.get()).toBe(true);
    expect(second.getExposes().active.get()).toBe(false);

    // Non-mouse or pressed-button movement must not steal focus or split active state.
    mouseMove(second, { pointerType: 'touch', buttons: 0 });
    mouseMove(second, { pointerType: 'pen', buttons: 0 });
    mouseMove(second, { pointerType: 'mouse', buttons: 1 });
    await flush();
    expect(document.activeElement).toBe(first);
    expect(first.getExposes().active.get()).toBe(true);
    expect(second.getExposes().active.get()).toBe(false);

    // Confirmed mouse hover hands off Focus and clears the initial item's highlight.
    mouseEnter(second);
    mouseMove(second);
    await flush();
    expect(document.activeElement).toBe(second);
    expect(first.getExposes().focused.get()).toBe(false);
    expect(first.getExposes().active.get()).toBe(false);
    expect(second.getExposes().focused.get()).toBe(true);
    expect(second.getExposes().active.get()).toBe(true);
    expect(tokens(first).has('bg-accent')).toBe(false);
    expect(tokens(second).has('bg-accent')).toBe(true);

    // Hovering an item without a value clears stale activeValue from the previous row.
    mouseMove(unvalued);
    await flush();
    expect(document.activeElement).toBe(unvalued);
    expect(second.getExposes().active.get()).toBe(false);
    expect(unvalued.getExposes().active.get()).toBe(true);

    // Disabled item must not take focus on mouse hover.
    mouseMove(disabledItem);
    await flush();
    expect(document.activeElement).toBe(unvalued);

    // Stationary hover on second does not paint a second row after focus moves back to first.
    mouseEnter(second);
    mouseMove(second);
    await flush();
    expect(tokens(second).has('bg-accent')).toBe(true);
    first.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(first);
    expect(tokens(first).has('bg-accent')).toBe(true);
    expect(tokens(second).has('bg-accent')).toBe(false);
  });

  it('menubar hands off Focus from initial item to hovered item and hovered open trigger', async () => {
    const root = make(menubar.menubarRoot.name);
    const t0 = make(menubar.menubarTrigger.name, { value: 'file' });
    const t1 = make(menubar.menubarTrigger.name, { value: 'edit' });
    const c0 = make(menubar.menubarContent.name, { value: 'file' });
    const c1 = make(menubar.menubarContent.name, { value: 'edit' });
    const i0 = make(menubar.menubarItem.name, { value: 'new' });
    const i1 = make(menubar.menubarItem.name, { value: 'print' });
    const i2 = make(menubar.menubarItem.name, { value: 'undo' });
    t0.textContent = 'File';
    t1.textContent = 'Edit';
    i0.textContent = 'New';
    i1.textContent = 'Print';
    i2.textContent = 'Undo';
    c0.append(i0, i1);
    c1.append(i2);
    root.append(t0, c0, t1, c1);
    document.body.append(root);
    const changes: Array<{ value: string; reason: string }> = [];
    root.addEventListener('valueChange', (e: any) => changes.push(e.detail));
    await flush();

    // Closed menubar trigger must not steal focus on hover.
    mouseMove(t0);
    await flush();
    expect(document.activeElement).not.toBe(t0);

    // Click File -> opens panel and focuses first item.
    t0.click();
    await flush();
    expect(document.activeElement).toBe(i0);
    expect(i0.getExposes().focused.get()).toBe(true);

    // Touch / pressed-button moves do not steal focus.
    mouseMove(i1, { pointerType: 'touch' });
    mouseMove(i1, { pointerType: 'mouse', buttons: 1 });
    await flush();
    expect(document.activeElement).toBe(i0);

    // Mouse hover over second item clears initial item focus.
    mouseMove(i1);
    await flush();
    expect(document.activeElement).toBe(i1);
    expect(i0.getExposes().focused.get()).toBe(false);
    expect(i1.getExposes().focused.get()).toBe(true);

    // Moving pointer onto Edit trigger switches menu and transfers focus to Edit trigger
    // without emitting a duplicate focus-switch request.
    mouseEnter(t1);
    mouseMove(t1);
    await flush();
    expect(root.getExposes().value.get()).toBe('edit');
    expect(document.activeElement).toBe(t1);
    expect(i1.getExposes().focused.get()).toBe(false);
    expect(t0.getExposes().focused.get()).toBe(false);
    expect(t1.getExposes().focused.get()).toBe(true);
    expect(changes).toEqual([
      { value: 'file', reason: 'trigger' },
      { value: 'edit', reason: 'pointer-switch' },
    ]);
  });

  it('controlled-reject menubar does not steal focus or emit spurious focus-switch on trigger hover', async () => {
    const root = make(menubar.menubarRoot.name, { value: 'file' });
    const t0 = make(menubar.menubarTrigger.name, { value: 'file' });
    const t1 = make(menubar.menubarTrigger.name, { value: 'edit' });
    const c0 = make(menubar.menubarContent.name, { value: 'file' });
    const i0 = make(menubar.menubarItem.name, { value: 'new' });
    c0.append(i0);
    root.append(t0, c0, t1);
    document.body.append(root);
    const changes: Array<{ value: string; reason: string }> = [];
    root.addEventListener('valueChange', (e: any) => changes.push(e.detail));
    await flush();

    i0.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(i0);

    mouseEnter(t1);
    mouseMove(t1);
    await flush();
    expect(root.getExposes().value.get()).toBe('file');
    expect(document.activeElement).toBe(i0);
    expect(changes).toEqual([{ value: 'edit', reason: 'pointer-switch' }]);
  });

  it('navigation-menu hands off Focus from trigger to hovered link/item and prevents stationary double highlight', async () => {
    const root = make(shadcnNavigation.navigationMenuRoot.name);
    const t0 = make(shadcnNavigation.navigationMenuTrigger.name, { value: 'docs' });
    const t1 = make(shadcnNavigation.navigationMenuTrigger.name, { value: 'api' });
    const c0 = make(shadcnNavigation.navigationMenuContent.name, { value: 'docs' });
    const c1 = make(shadcnNavigation.navigationMenuContent.name, { value: 'api' });
    const link0 = make(shadcnNavigation.navigationMenuLink.name, { href: '#intro' });
    const link1 = make(shadcnNavigation.navigationMenuLink.name, { href: '#install' });
    const item0 = make(shadcnNavigation.navigationMenuItem.name, { value: 'search' });
    const linkApi = make(shadcnNavigation.navigationMenuLink.name, { href: '#api' });
    t0.textContent = 'Docs';
    t1.textContent = 'API';
    link0.textContent = 'Intro';
    link1.textContent = 'Install';
    item0.textContent = 'Search';
    linkApi.textContent = 'API Ref';
    c0.append(link0, link1, item0);
    c1.append(linkApi);
    root.append(t0, c0, t1, c1);
    document.body.append(root);
    await flush();

    // Open Docs panel while Trigger 0 has focus.
    t0.focus();
    t0.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('docs');
    expect(t0.getExposes().focused.get()).toBe(true);

    // Mouse hover over link1 inside open Content hands off DOM focus from trigger to link1's <a>.
    const a0 = link0.querySelector('a')!;
    const a1 = link1.querySelector('a')!;
    mouseEnter(link1);
    mouseMove(a1);
    await flush();
    expect(document.activeElement).toBe(a1);
    expect(t0.getExposes().focused.get()).toBe(false);
    expect(link1.getExposes().focused.get()).toBe(true);
    expect(tokens(a1).has('bg-accent') || tokens(a1).has('bg-muted')).toBe(true);

    // Moving mouse to item0 clears link1's focus and highlight.
    mouseMove(item0);
    await flush();
    expect(document.activeElement).toBe(item0);
    expect(link1.getExposes().focused.get()).toBe(false);
    expect(item0.getExposes().focused.get()).toBe(true);
    expect(tokens(a1).has('bg-accent') || tokens(a1).has('bg-muted')).toBe(false);

    // Stationary hover on link1 must not paint a second row after keyboard focus moves to link0.
    mouseEnter(link1);
    mouseMove(a1);
    await flush();
    link0.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(a0);
    expect(tokens(a0).has('bg-accent') || tokens(a0).has('bg-muted')).toBe(true);
    expect(tokens(a1).has('bg-accent') || tokens(a1).has('bg-muted')).toBe(false);

    // Switching to API trigger hands off focus from link0 to API trigger.
    mouseEnter(t1);
    mouseMove(t1);
    await flush();
    expect(root.getExposes().value.get()).toBe('api');
    expect(document.activeElement).toBe(t1);
    expect(link0.getExposes().focused.get()).toBe(false);
    expect(t0.getExposes().focused.get()).toBe(false);
    expect(t1.getExposes().focused.get()).toBe(true);
  });

  for (const spec of [
    {
      name: 'brutalist',
      mod: brutalistNavigation,
      triggerHighlightToken: 'bg-secondary-background',
      highlightToken: 'bg-main',
    },
    {
      name: 'bootstrap-2-3-2',
      mod: bootstrapNavigation,
      triggerHighlightToken: 'bg-[#eee]',
      highlightToken: 'bg-[linear-gradient(#08c,#0077b3)]',
    },
    {
      name: 'liquid-glass',
      mod: liquidNavigation,
      triggerHighlightToken: 'bg-muted',
      highlightToken: 'bg-muted',
    },
  ] as const) {
    it(`${spec.name} navigation-menu keeps closed-menu trigger hover and non-family-content link/item hover while preventing stale hover double-highlight inside open Content`, async () => {
      const root = make(spec.mod.navigationMenuRoot.name);
      const trigger = make(spec.mod.navigationMenuTrigger.name, { value: 'docs' });
      const content = make(spec.mod.navigationMenuContent.name, { value: 'docs' });
      const link0 = make(spec.mod.navigationMenuLink.name, { href: '#intro' });
      const link1 = make(spec.mod.navigationMenuLink.name, { href: '#install' });
      const item0 = make(spec.mod.navigationMenuItem.name, { value: 'search' });
      trigger.textContent = 'Docs';
      link0.textContent = 'Intro';
      link1.textContent = 'Install';
      item0.textContent = 'Search';
      content.append(link0, link1, item0);
      root.append(trigger, content);
      document.body.append(root);
      await flush();

      // When no panel is open, hovering top-level trigger highlights cleanly without stealing focus.
      expect(tokens(trigger).has(spec.triggerHighlightToken)).toBe(false);
      mouseEnter(trigger);
      await flush();
      expect(tokens(trigger).has(spec.triggerHighlightToken)).toBe(true);

      // Inside open family Content, hover hands off Focus and keyboard move clears old row completely.
      trigger.focus();
      trigger.click();
      await flush();
      const a0 = link0.querySelector('a')!;
      const a1 = link1.querySelector('a')!;
      mouseEnter(link1);
      mouseMove(a1);
      await flush();
      expect(document.activeElement).toBe(a1);
      expect(tokens(a1).has(spec.highlightToken)).toBe(true);

      link0.getExposes().focusSelf({ reason: 'keyboard' });
      await flush();
      expect(document.activeElement).toBe(a0);
      expect(tokens(a0).has(spec.highlightToken)).toBe(true);
      expect(tokens(a1).has(spec.highlightToken)).toBe(false);

      // Outside family Content paint context (e.g. Base content host), hovered still highlights link/item.
      const baseRoot = make(navigation.navigationMenuRoot.name, { defaultValue: 'docs' });
      const baseContent = make(navigation.navigationMenuContent.name, { value: 'docs' });
      const standaloneLink = make(spec.mod.navigationMenuLink.name, { href: '#standalone' });
      const standaloneItem = make(spec.mod.navigationMenuItem.name, { value: 'standalone-item' });
      standaloneLink.textContent = 'Standalone Link';
      standaloneItem.textContent = 'Standalone Item';
      baseContent.append(standaloneLink, standaloneItem);
      baseRoot.append(baseContent);
      document.body.append(baseRoot);
      await flush();

      const standaloneAnchor = standaloneLink.querySelector('a')!;
      expect(tokens(standaloneAnchor).has(spec.highlightToken)).toBe(false);
      mouseEnter(standaloneLink);
      await flush();
      expect(tokens(standaloneAnchor).has(spec.highlightToken)).toBe(true);

      expect(tokens(standaloneItem).has(spec.highlightToken)).toBe(false);
      mouseEnter(standaloneItem);
      await flush();
      expect(tokens(standaloneItem).has(spec.highlightToken)).toBe(true);
    });
  }
});
