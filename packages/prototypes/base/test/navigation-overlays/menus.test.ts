import { activationTurn } from '../../../../modules/native-link/test/no-network';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as menubar from '../../src/menubar';
import * as navigation from '../../src/navigation-menu';
import * as contextMenu from '../../src/context-menu';
const owned = new Set<HTMLElement>();
const lifecycle = new Map<string, { created: number; disposed: number }>();
for (const module of [menubar, navigation, contextMenu])
  for (const p of Object.values(module))
    if (p && typeof p === 'object' && 'name' in p && 'setup' in p)
      AdaptToWebComponent(p as any, {
        diagnostics: {
          onLifecycleEvent(e) {
            const x = lifecycle.get(p.name) ?? { created: 0, disposed: 0 };
            if (e.type === 'instance.created') x.created++;
            if (e.type === 'instance.dispose.done') x.disposed++;
            lifecycle.set(p.name, x);
          },
        },
      });
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const e of owned) e.remove();
  owned.clear();
  await expect
    .poll(() => [...lifecycle.values()].every((x) => x.created === x.disposed))
    .toBe(true);
});
function el(name: string, props = {}): any {
  const e = document.createElement(name);
  setElementProps(e, props);
  owned.add(e);
  return e;
}
function bar(slug: string, props = {}) {
  const root = el(`base-${slug}-root`, props);
  const triggers = ['file', 'edit'].map((value) => {
    const x = el(`base-${slug}-trigger`, { value });
    x.textContent = value;
    return x;
  });
  const panels = ['file', 'edit'].map((value) => el(`base-${slug}-content`, { value }));
  const items = ['new', 'undo'].map((value) => {
    const x = el(`base-${slug}-item`, { value, textValue: value });
    x.textContent = value;
    return x;
  });
  panels.forEach((p, i) => p.append(items[i]));
  root.append(triggers[0], panels[0], triggers[1], panels[1]);
  document.body.append(root);
  return { root, triggers, panels, items };
}
describe.each(['menubar', 'navigation-menu'])('%s', (slug) => {
  it('opens the matching panel and switches without leaking sibling state', async () => {
    const p = bar(slug);
    await flush();
    expect(p.root.getAttribute('role')).toBe(slug === 'menubar' ? 'menubar' : 'navigation');
    p.triggers[0].click();
    await flush();
    expect(p.root.getExposes().value.get()).toBe('file');
    expect(p.panels.map((v) => v.getExposes().open.get())).toEqual([true, false]);
    p.triggers[1].click();
    await flush();
    expect(p.panels.map((v) => v.getExposes().open.get())).toEqual([false, true]);
    const selected: unknown[] = [];
    p.items[1].addEventListener('select', (e: any) => selected.push(e.detail));
    p.items[1].click();
    await flush();
    expect(selected).toEqual([{ value: 'undo', menuValue: 'edit' }]);
    expect(p.root.getExposes().value.get()).toBe('');
  });
  it('keeps controlled active menu and rejects disabled activation', async () => {
    const p = bar(slug, { value: 'file' });
    await flush();
    p.triggers[1].click();
    await flush();
    expect(p.root.getExposes().value.get()).toBe('file');
    setElementProps(p.root, { disabled: true });
    expect(p.root.getExposes().requestValue('edit')).toBe(false);
  });
});
it('menubar arrows move among menu commands then across top-level menus', async () => {
  const p = bar('menubar');
  await flush();
  expect(p.triggers.map((x) => x.tabIndex)).toEqual([0, -1]);
  p.triggers[0].click();
  await flush();
  await expect.poll(() => document.activeElement).toBe(p.items[0]);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await flush();
  expect(p.root.getExposes().value.get()).toBe('edit');
  expect(document.activeElement).toBe(p.triggers[1]);
});
it('navigation Link emits destination intent and current-page semantics', async () => {
  const p = bar('navigation-menu', { defaultValue: 'file' });
  const link = el('base-navigation-menu-link', { href: '#docs', current: true });
  link.textContent = 'Docs';
  p.panels[0].append(link);
  await flush();
  const events: unknown[] = [];
  link.addEventListener('navigate', (e: any) => events.push(e.detail));
  link.querySelector('a')!.click();
  await activationTurn();
  await flush();
  expect(events).toEqual([{ href: '#docs', target: '_self', rel: '', modified: false }]);
  expect(link.querySelector('a')!.getAttribute('role')).toBe('link');
});
it('context menu opens on context intent, not ordinary click', async () => {
  const root = el(contextMenu.contextMenuRoot.name),
    trigger = el(contextMenu.contextMenuTrigger.name),
    content = el(contextMenu.contextMenuContent.name),
    item = el(contextMenu.contextMenuItem.name, { value: 'copy' });
  content.append(item);
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  trigger.click();
  expect(root.getExposes().open.get()).toBe(false);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  trigger.dispatchEvent(event);
  await flush();
  expect(event.defaultPrevented).toBe(true);
  expect(root.getExposes().open.get()).toBe(true);
  item.click();
  await flush();
  expect(root.getExposes().open.get()).toBe(false);
});
