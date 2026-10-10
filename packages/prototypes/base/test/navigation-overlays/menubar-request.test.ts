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

describe.each<Ownership>(['reject', 'accept', 'uncontrolled'])('Menubar %s owner', (mode) => {
  for (const [keyName, from, to] of [
    ['ArrowRight', 0, 1],
    ['ArrowLeft', 1, 0],
  ] as const) {
    it(`${keyName} from a real focused command emits one request and focuses the adjacent trigger`, async () => {
      const p = await bar(mode, values[from]);
      await p.focusItem(from);
      key(keyName);
      await flush();
      expect(p.requests).toEqual([{ value: values[to], reason: 'focus-switch' }]);
      expect(document.activeElement).toBe(p.triggers[to]);
      expect(p.root.getExposes().value.get()).toBe(values[mode === 'reject' ? from : to]);
      expect(p.panels.map((panel) => panel.getExposes().open.get())).toEqual(
        values.map((_, i) => i === (mode === 'reject' ? from : to))
      );
    });
  }
  for (const [keyName, from, to] of [
    ['ArrowRight', 1, 2],
    ['ArrowLeft', 1, 0],
    ['Home', 1, 0],
    ['End', 0, 2],
  ] as const) {
    it(`${keyName} remains owned by trigger roving with exactly one open-menu request`, async () => {
      const p = await bar(mode, values[from]);
      await p.focusTrigger(from);
      key(keyName);
      await flush();
      expect(p.requests).toEqual([{ value: values[to], reason: 'focus-switch' }]);
      expect(document.activeElement).toBe(p.triggers[to]);
      expect(p.root.getExposes().value.get()).toBe(values[mode === 'reject' ? from : to]);
    });
  }
});

for (const [keyName, from, to] of [
  ['ArrowRight', 1, 2],
  ['ArrowLeft', 1, 0],
  ['Home', 1, 0],
  ['End', 0, 2],
] as const) {
  it(`RTL host ${keyName} retains a single request under the existing physical roving policy`, async () => {
    // This proves request cardinality, not logical RTL mirroring: the current
    // public FocusRoving contract/config has no direction input. Keep that gap explicit.
    const p = await bar('reject', values[from], true);
    await p.focusTrigger(from);
    key(keyName);
    await flush();
    expect(p.requests).toEqual([{ value: values[to], reason: 'focus-switch' }]);
    expect(document.activeElement).toBe(p.triggers[to]);
    expect(p.root.getExposes().value.get()).toBe(values[from]);
  });
  it(`closed ${keyName} is focus-only and cannot open a menu`, async () => {
    const p = await bar('reject', '');
    await p.focusTrigger(from);
    key(keyName);
    await flush();
    expect(p.requests).toEqual([]);
    expect(document.activeElement).toBe(p.triggers[to]);
    expect(p.panels.every((panel) => !panel.getExposes().open.get())).toBe(true);
  });
}
for (const [keyName, to] of [
  ['Home', 0],
  ['End', 2],
] as const) {
  it(`command ${keyName} stays in its vertical roving set without requesting another menu`, async () => {
    const p = await bar('reject');
    await p.focusItem(0, 1);
    key(keyName);
    await flush();
    expect(p.requests).toEqual([]);
    expect(document.activeElement).toBe(p.items[0]![to]);
  });
}
it('a rejected request does not deduplicate later independent keyboard or public requests', async () => {
  const p = await bar('reject');
  for (let i = 0; i < 2; i++) {
    await p.focusItem(0);
    key('ArrowRight');
    await flush();
  }
  expect(p.requests).toEqual([
    { value: 'edit', reason: 'focus-switch' },
    { value: 'edit', reason: 'focus-switch' },
  ]);
  expect(p.root.getExposes().requestValue('edit', 'application')).toBe(true);
  expect(p.root.getExposes().requestValue('edit', 'application')).toBe(true);
  expect(p.requests.slice(2)).toEqual([
    { value: 'edit', reason: 'application' },
    { value: 'edit', reason: 'application' },
  ]);
  expect(p.root.getExposes().value.get()).toBe('file');
});
it('independent focus switches remain observable without a navigation intent', async () => {
  const p = await bar('reject');
  await p.focusTrigger(1);
  await p.focusTrigger(0);
  await p.focusTrigger(1);
  expect(p.requests).toEqual([
    { value: 'edit', reason: 'focus-switch' },
    { value: 'edit', reason: 'focus-switch' },
  ]);
});
it('synchronous application reentry supersedes the older navigation continuation without dropping its request', async () => {
  const p = await bar('reject');
  p.root.addEventListener('valueChange', (event) => {
    const request = (event as CustomEvent<Request>).detail;
    if (request.value !== 'edit') return;
    p.root.getExposes().requestValue('view', 'application');
    setElementProps(p.root, { value: 'view' });
    p.triggers[2]!.getExposes().focusSelf({ reason: 'programmatic' });
  });
  await p.focusItem(0);
  key('ArrowRight');
  await flush();
  expect(p.requests).toEqual([
    { value: 'edit', reason: 'focus-switch' },
    { value: 'view', reason: 'application' },
  ]);
  expect(p.root.getExposes().value.get()).toBe('view');
  expect(document.activeElement).toBe(p.triggers[2]);
  expect(p.triggers.map((trigger) => trigger.tabIndex)).toEqual([-1, -1, 0]);
});
it('terminal disposal during the synchronous request cannot publish a stale fallback', async () => {
  const p = await bar('reject');
  p.root.addEventListener('valueChange', () => p.root.remove(), { once: true });
  await p.focusItem(0);
  key('ArrowRight');
  await flush();
  expect(p.requests).toEqual([{ value: 'edit', reason: 'focus-switch' }]);
  expect(p.root.isConnected).toBe(false);
});
it('disabled adjacent triggers are skipped without creating a second request', async () => {
  const p = await bar('reject');
  setElementProps(p.triggers[1]!, { value: 'edit', disabled: true });
  await flush();
  await p.focusItem(0);
  key('ArrowRight');
  await flush();
  expect(p.requests).toEqual([{ value: 'view', reason: 'focus-switch' }]);
  expect(document.activeElement).toBe(p.triggers[2]);
});

it('delayed controlled acceptance updates the original requested panel without another request', async () => {
  const p = await bar('reject');
  await p.focusItem(0);
  key('ArrowRight');
  await flush();
  expect(p.requests).toEqual([{ value: 'edit', reason: 'focus-switch' }]);
  expect(p.root.getExposes().value.get()).toBe('file');
  setElementProps(p.root, { value: 'edit' });
  await flush();
  expect(p.requests).toHaveLength(1);
  expect(p.panels.map((panel) => panel.getExposes().open.get())).toEqual([false, true, false]);
  expect(document.activeElement).toBe(p.triggers[1]);
});
it('unapplied host focus still permits one navigation fallback and a later independent focus request', async () => {
  const p = await bar('reject');
  await p.focusItem(0);
  // Explicit injection: the host refuses this synchronous focus application.
  const focus = vi.spyOn(p.triggers[1]!, 'focus').mockImplementation(() => {});
  key('ArrowRight');
  await flush();
  expect(p.requests).toEqual([{ value: 'edit', reason: 'horizontal-navigation' }]);
  expect(document.activeElement).toBe(p.items[0]![0]);
  expect(p.root.getExposes().value.get()).toBe('file');
  focus.mockRestore();
  await p.focusTrigger(1);
  expect(p.requests).toEqual([
    { value: 'edit', reason: 'horizontal-navigation' },
    { value: 'edit', reason: 'focus-switch' },
  ]);
});
