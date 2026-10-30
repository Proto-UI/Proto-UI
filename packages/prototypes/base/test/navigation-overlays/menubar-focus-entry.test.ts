import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOCUS_CENTER } from '../../../../modules/focus/src/center';
import { OverlayModuleImpl } from '../../../../modules/overlay/src/impl';
import { BoundaryModuleImpl } from '../../../../modules/boundary/src/impl';
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
function invocationStack() {
  const previous = Error.stackTraceLimit;
  try {
    Error.stackTraceLimit = 32;
    return new Error('entry diagnostic').stack ?? 'stack unavailable';
  } finally {
    Error.stackTraceLimit = previous;
  }
}
// Test-only observation: preserve arguments, return values and thrown errors.
// No host getters are sampled and no request/cancellation method is invoked.
function traceEntry() {
  const events: Array<Record<string, unknown>> = [];
  let dropped = 0;
  const ids = new Map<unknown, number>();
  const id = (value: unknown) => {
    if (value == null) return null;
    if (!ids.has(value)) ids.set(value, ids.size + 1);
    return ids.get(value);
  };
  const record = (event: Record<string, unknown>) => {
    if (events.length < 160) events.push(event);
    else dropped++;
  };
  for (const method of ['focusInRoving', 'applyFocusInRoving'] as const) {
    const center = FOCUS_CENTER as any;
    const original = center[method];
    vi.spyOn(center, method).mockImplementation(function (this: any, ...args: any[]) {
      record({
        event: method,
        provider: id(args[0]?.instance),
        op: args[1],
        intent: id(args[3]),
        requireFocusedMember: args[2]?.requireFocusedMember,
        defer: args[2]?.entryRequest?.defer,
        requestEpoch: this.requestEpoch,
        ownerEpoch: this.ownerEpoch,
        pending: this.pendingRovingEntries?.size ?? null,
      });
      return Reflect.apply(original, this, args);
    });
  }
  const overlay = OverlayModuleImpl.prototype as any;
  const reconcile = overlay.afterViewReconciled;
  vi.spyOn(overlay, 'afterViewReconciled').mockImplementation(function (
    this: any,
    callback: () => void
  ) {
    const owner = id(this);
    record({ event: 'barrier-register', owner, mountPhase: this.mountPhase });
    return Reflect.apply(reconcile, this, [
      () => {
        record({ event: 'barrier-deliver', owner, mountPhase: this.mountPhase });
        return callback();
      },
    ]);
  });
  const boundary = BoundaryModuleImpl.prototype as any;
  const notify = boundary.notifyObserved;
  vi.spyOn(boundary, 'notifyObserved').mockImplementation(function (this: any, ...args: any[]) {
    if (args[1] === 'focus.move')
      record({
        event: 'boundary-focus',
        owner: id(this),
        prototypeName: this.prototypeName,
        suspended: this.stackEntry?.suspended ?? null,
        stackActive: this.stackActive,
        mountPhase: this.mountPhase,
      });
    return Reflect.apply(notify, this, args);
  });
  return () => ({ events, dropped });
}
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
it('allows a committed press from an initially unfocused trigger', async () => {
  const p = await bar('uncontrolled', '');
  expect(p.triggers[0]!.getExposes().focused.get()).toBe(false);
  p.triggers[0]!.click();
  await flush();
  expect(p.panels[0]!.parentElement).toBe(document.body);
  expect(document.activeElement).toBe(p.items[0]![0]);
  expect(p.root.getExposes().value.get()).toBe('file');
  expect(p.requests).toEqual([{ value: 'file', reason: 'trigger' }]);
});
it('does not let an initially unfocused press steal later author focus', async () => {
  const p = await bar('uncontrolled', '');
  const trace = traceEntry();
  const outside = document.createElement('button');
  document.body.append(outside);
  owned.add(outside);
  expect(p.triggers[0]!.getExposes().focused.get()).toBe(false);
  const append = document.body.appendChild.bind(document.body);
  let interrupted = false;
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    const result = append(node);
    if (node === p.panels[0] && !interrupted) {
      interrupted = true;
      outside.focus();
    }
    return result;
  });
  p.triggers[0]!.click();
  await flush();
  expect(interrupted).toBe(true);
  expect(document.activeElement, JSON.stringify(trace())).toBe(outside);
  expect(p.root.getExposes().value.get()).toBe('file');
  setElementProps(p.panels[0]!, { sideOffset: 8 });
  await flush();
  expect(document.activeElement).toBe(outside);
});
for (const keyName of ['ArrowDown', 'ArrowUp'] as const) {
  it(`${keyName} requests actual focus only after the physical portal acquisition`, async () => {
    const p = await bar('uncontrolled', '');
    await p.focusTrigger(0);
    const target = p.items[0]![keyName === 'ArrowDown' ? 0 : 2]!;
    const trace = traceEntry();
    const observed: boolean[] = [];
    const focusStacks: string[] = [];
    const original = target.focus.bind(target);
    vi.spyOn(target, 'focus').mockImplementation((options) => {
      observed.push(p.panels[0]!.parentElement === document.body);
      focusStacks.push(invocationStack());
      original(options);
    });
    key(keyName);
    await flush();
    expect(observed, JSON.stringify({ focusStacks, requests: p.requests, trace: trace() })).toEqual(
      [true]
    );
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
    const trace = traceEntry();
    const observations: Array<Record<string, unknown>> = [];
    const observe = (event: string, stack?: string) =>
      observations.push({
        event,
        rootConnected: p.root.isConnected,
        triggerConnected: p.triggers[0]!.isConnected,
        contentConnected: p.panels[0]!.isConnected,
        contentParent: p.panels[0]!.parentElement?.tagName ?? null,
        active: document.activeElement?.tagName ?? null,
        stack,
      });
    const originalFocus = target.focus.bind(target);
    const focus = vi.spyOn(target, 'focus').mockImplementation((options) => {
      observe('focus', invocationStack());
      originalFocus(options);
    });
    const append = document.body.appendChild.bind(document.body);
    let interrupted = false;
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node === p.panels[0]) observe('portal-append-enter');
      const result = append(node);
      if (node === p.panels[0]) observe('portal-append-return');
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
        if (interrupt === 'remove') {
          observe('remove-before');
          p.root.remove();
          observe('remove-after');
        }
      }
      return result;
    });
    key('ArrowDown');
    await flush();
    expect(interrupted).toBe(true);
    expect(focus, JSON.stringify({ observations, trace: trace() })).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(target);
    if (interrupt === 'outside-focus') expect(document.activeElement).toBe(outside);
    // A later reconciliation cannot revive the canceled command.
    if (p.root.isConnected) setElementProps(p.panels[0]!, { sideOffset: 8 });
    await flush();
    expect(focus).not.toHaveBeenCalled();
  });
}
