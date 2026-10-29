import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import {
  menubarRoot,
  menubarTrigger,
  menubarContent,
  menubarItem,
  type MenubarRootProps,
} from '../../src/menubar';

let created = 0,
  disposed = 0;
for (const proto of [menubarRoot, menubarTrigger, menubarContent, menubarItem])
  AdaptToWebComponent(proto, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') created++;
        if (event.type === 'instance.dispose.done') disposed++;
      },
    },
  });
type Root = WebComponentAdapterElement<typeof menubarRoot>;
type Trigger = WebComponentAdapterElement<typeof menubarTrigger>;
type Content = WebComponentAdapterElement<typeof menubarContent>;
type Item = WebComponentAdapterElement<typeof menubarItem>;
type Request = { value: string; reason: string };
type Ownership = 'reject' | 'accept' | 'uncontrolled';
const values = ['file', 'edit', 'view'];
const owned = new Set<HTMLElement>();
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const root of owned) root.remove();
  owned.clear();
  vi.restoreAllMocks();
  await expect.poll(() => disposed).toBe(created);
});
function key(key: string) {
  return window.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
}
async function bar(mode: Ownership, initial = 'file', rtl = false, props: MenubarRootProps = {}) {
  const root = document.createElement(menubarRoot.name) as Root;
  setElementProps(root, {
    ...(mode === 'uncontrolled' ? { defaultValue: initial } : { value: initial }),
    ...props,
  });
  if (rtl) root.dir = 'rtl';
  const triggers = values.map((value) => {
    const trigger = document.createElement(menubarTrigger.name) as Trigger;
    owned.add(trigger);
    setElementProps(trigger, { value });
    trigger.textContent = value;
    return trigger;
  });
  const panels = values.map((value) => {
    const panel = document.createElement(menubarContent.name) as Content;
    owned.add(panel);
    setElementProps(panel, { value });
    return panel;
  });
  const items = values.map((value) =>
    ['first', 'middle', 'last'].map((suffix) => {
      const item = document.createElement(menubarItem.name) as Item;
      owned.add(item);
      setElementProps(item, { value: value + '-' + suffix });
      item.textContent = value + ' ' + suffix;
      return item;
    })
  );
  panels.forEach((panel, i) => {
    panel.append(...items[i]!);
    root.append(triggers[i]!, panel);
  });
  document.body.append(root);
  owned.add(root);
  await flush();
  const requests: Request[] = [];
  root.addEventListener('valueChange', (event) => {
    const detail = (event as CustomEvent<Request>).detail;
    requests.push(detail);
    if (mode === 'accept') setElementProps(root, { value: detail.value });
  });
  const focusItem = async (menu: number, index = 0) => {
    items[menu]![index]!.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(items[menu]![index]);
  };
  const focusTrigger = async (index: number) => {
    triggers[index]!.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(triggers[index]);
  };
  return { root, triggers, panels, items, requests, focusItem, focusTrigger };
}

// These tests interrupt the actual adapter-owned portal acquisition, rather than
// substituting a ready signal or changing the public demo. Native acceptance
// remains the separate four-Web browser suite.
for (const keyName of ['ArrowDown', 'ArrowUp'] as const) {
  it(`${keyName} requests actual focus only after the physical portal acquisition`, async () => {
    const p = await bar('uncontrolled', '');
    await p.focusTrigger(0);
    const target = p.items[0]![keyName === 'ArrowDown' ? 0 : 2]!;
    const observed: boolean[] = [];
    const original = target.focus.bind(target);
    vi.spyOn(target, 'focus').mockImplementation((options) => {
      observed.push(p.panels[0]!.parentElement === document.body);
      original(options);
    });
    key(keyName);
    await flush();
    expect(observed).toEqual([true]);
    expect(document.activeElement).toBe(target);
    expect(p.requests).toEqual([{ value: 'file', reason: 'keyboard' }]);
  });
}
for (const interrupt of [
  'outside-focus',
  'blur-refocus',
  'close',
  'close-reopen',
  'disable',
  'remove',
] as const) {
  it(`does not resurrect entry after ${interrupt} during resource acquisition`, async () => {
    const p = await bar('accept', '');
    await p.focusTrigger(0);
    const outside = document.createElement('button');
    document.body.append(outside);
    owned.add(outside);
    const target = p.items[0]![0]!;
    const focus = vi.spyOn(target, 'focus');
    const append = document.body.appendChild.bind(document.body);
    let interrupted = false;
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const result = append(node);
      if (node === p.panels[0] && !interrupted) {
        interrupted = true;
        if (interrupt === 'outside-focus') outside.focus();
        if (interrupt === 'blur-refocus') {
          p.triggers[0]!.blur();
          p.triggers[0]!.focus();
        }
        if (interrupt === 'close' || interrupt === 'close-reopen') {
          setElementProps(p.root, { value: '' });
          if (interrupt === 'close-reopen') setElementProps(p.root, { value: 'file' });
        }
        if (interrupt === 'disable') setElementProps(p.root, { disabled: true });
        if (interrupt === 'remove') p.root.remove();
      }
      return result;
    });
    key('ArrowDown');
    await flush();
    expect(interrupted).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(target);
    if (interrupt === 'outside-focus') expect(document.activeElement).toBe(outside);
    // A later reconciliation cannot revive the canceled command.
    if (p.root.isConnected) setElementProps(p.panels[0]!, { sideOffset: 8 });
    await flush();
    expect(focus).not.toHaveBeenCalled();
  });
}
