import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/drawer';
import * as shadcn from '../../shadcn/src/drawer';

const roots: HTMLElement[] = [];
let created = 0,
  disposed = 0,
  id = 0;
const register = (p: any) =>
  AdaptToWebComponent(p, {
    diagnostics: {
      onLifecycleEvent(e) {
        if (e.type === 'instance.created') created++;
        if (e.type === 'instance.dispose.done') disposed++;
      },
    },
  });
for (const p of [
  base.drawerRoot,
  base.drawerContent,
  shadcn.drawerRoot,
  shadcn.drawerContent,
  shadcn.drawerHeader,
  shadcn.drawerFooter,
  shadcn.drawerTitle,
])
  register(p);
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((r) => r.remove());
  await flush();
  await expect.poll(() => disposed).toBe(created);
});
function fixture(side = 'bottom', mixed = false) {
  const root = document.createElement(mixed ? base.drawerRoot.name : shadcn.drawerRoot.name);
  const content = document.createElement(shadcn.drawerContent.name) as any;
  setElementProps(root, { defaultOpen: false });
  setElementProps(content, { side, enterDuration: 0, leaveDuration: 0 });
  const header = document.createElement(shadcn.drawerHeader.name) as any;
  content.append(header);
  root.append(content);
  roots.push(root);
  return { root, content, header };
}
function probe(target: { handle?: base.DrawerAcceptedSideObservation; values: unknown[] }) {
  const name = `x-drawer-side-probe-${++id}`;
  register(
    definePrototype({
      name,
      setup() {
        const a = base.asDrawerAcceptedSide();
        expect(base.asDrawerAcceptedSide()).toBe(a);
        target.handle = a;
        a.observe((value) => target.values.push(value));
      },
    })
  );
  return document.createElement(name);
}
const tokens = (node: Element) => (node.getAttribute('data-pui-style') ?? '').split(' ');

describe('owner-local read-only Drawer direction', () => {
  it.each(['top', 'right', 'bottom', 'left'])(
    'initial %s side reaches Header through accepted Content, without public write authority',
    async (side) => {
      const p = fixture(side),
        facts = { values: [] } as Parameters<typeof probe>[0];
      p.header.append(probe(facts));
      document.body.append(p.root);
      await flush();
      expect(facts.handle?.read()).toBe(side);
      expect(Object.keys(facts.handle!)).toEqual(['read', 'observe']);
      expect(Object.isFrozen(facts.handle)).toBe(true);
      expect(Object.keys(p.header.getExposes())).toEqual([]);
      expect(tokens(p.header)).toEqual(
        expect.arrayContaining(['flex', 'flex-col', 'gap-0.5', 'p-4'])
      );
      expect(tokens(p.header).includes('text-center')).toBe(side === 'top' || side === 'bottom');
    }
  );
  it('valid-invalid-valid updates retain accepted side and remove stale directional rules', async () => {
    const p = fixture('top');
    document.body.append(p.root);
    await flush();
    setElementProps(p.content, { side: 'diagonal' });
    await flush();

    expect(tokens(p.header)).toContain('text-center');
    setElementProps(p.content, { side: 'left' });
    await flush();

    expect(tokens(p.header)).not.toContain('text-center');
    setElementProps(p.content, { side: 'bottom', maxExtent: { unit: 'logical', value: -1 } });
    await flush();

    setElementProps(p.content, { side: 'bottom', maxExtent: { unit: 'logical', value: 300 } });
    await flush();

    expect(tokens(p.header)).toContain('text-center');
  });
  it('mixed families and nested Roots observe only their own Content, including missing local Content', async () => {
    const outer = fixture('top', true),
      inner = fixture('right', true);
    const emptyRoot = document.createElement(base.drawerRoot.name);
    roots.push(emptyRoot);
    const a = { values: [] } as Parameters<typeof probe>[0],
      b = { values: [] } as Parameters<typeof probe>[0];
    const missing = { values: [] } as Parameters<typeof probe>[0];
    outer.header.append(probe(a));
    inner.header.append(probe(b));
    emptyRoot.append(probe(missing));
    outer.content.append(inner.root, emptyRoot);
    document.body.append(outer.root);
    await flush();
    expect(a.handle?.read()).toBe('top');
    expect(b.handle?.read()).toBe('right');
    expect(missing.handle?.read()).toBeNull();
    setElementProps(outer.content, { side: 'left' });
    await flush();
    expect(a.handle?.read()).toBe('left');
    expect(b.handle?.read()).toBe('right');
    expect(missing.handle?.read()).toBeNull();
    inner.root.remove();
    await flush();
    const count = b.values.length;
    setElementProps(outer.content, { side: 'bottom' });
    await flush();
    expect(b.values).toHaveLength(count);
  });
  it('an early observer binds late Content, releases replacement, and does not retain retired subscriptions', async () => {
    const root = document.createElement(base.drawerRoot.name);
    roots.push(root);
    const facts = { values: [] } as Parameters<typeof probe>[0];
    root.append(probe(facts));
    document.body.append(root);
    await flush();
    expect(facts.handle?.read()).toBeNull();
    const old = document.createElement(base.drawerContent.name) as any;
    setElementProps(old, { side: 'top', enterDuration: 0, leaveDuration: 0 });
    old.append(root.firstElementChild!);
    root.append(old);
    await flush();
    expect(facts.handle?.read()).toBe('top');
    root.append(old.firstElementChild!);
    old.remove();
    await flush();
    expect(facts.handle?.read()).toBeNull();
    const next = document.createElement(base.drawerContent.name);
    setElementProps(next, { side: 'right', enterDuration: 0, leaveDuration: 0 });
    next.append(root.firstElementChild!);
    root.append(next);
    await flush();
    expect(facts.handle?.read()).toBe('right');
  });
  it('Content hook projects frozen observation without a raw state capture escape', async () => {
    let handle: base.DrawerContentHandles | undefined;
    const name = `x-drawer-content-observation-${++id}`;
    register(
      definePrototype<base.DrawerContentProps>({
        name,
        setup() {
          handle = base.asDrawerContent();
          expect(base.asDrawerContent()).toBe(handle);
        },
      })
    );
    const root = document.createElement(base.drawerRoot.name),
      content = document.createElement(name);
    roots.push(root);
    setElementProps(content, { side: 'left' });
    root.append(content);
    document.body.append(root);
    await flush();
    expect(handle?.acceptedSide.read()).toBe('left');
    expect(Object.keys(handle!.acceptedSide)).toEqual(['read', 'observe']);
    expect(handle).not.toHaveProperty('getState');
    expect(handle!.stateHandles).not.toHaveProperty('drawerSide');
    expect(handle!.acceptedSide).not.toHaveProperty('set');
    expect(handle!.acceptedSide).not.toHaveProperty('setDefault');
  });
  it('retained observer reparent clears stale context and rebinds only once', async () => {
    const p = fixture('top');
    const facts = { values: [] } as Parameters<typeof probe>[0];
    const observer = probe(facts);
    p.header.append(observer);
    document.body.append(p.root);
    await flush();
    expect(facts.handle?.read()).toBe('top');
    p.root.append(observer);
    await flush();
    expect(facts.handle?.read()).toBeNull();
    p.header.append(observer);
    await flush();
    expect(facts.handle?.read()).toBe('top');
    const before = facts.values.length;
    setElementProps(p.content, { side: 'left' });
    await flush();
    expect(facts.handle?.read()).toBe('left');
    expect(facts.values.slice(before)).toEqual(['left']);
  });
  it('removing the owner during direction publication stops later observation callbacks', async () => {
    const p = fixture('top');
    const name = `x-drawer-reentrant-side-${++id}`;
    let calls = 0;
    register(
      definePrototype({
        name,
        setup() {
          base.asDrawerAcceptedSide().observe((side) => {
            calls++;
            if (side === 'left') p.root.remove();
          });
        },
      })
    );
    p.header.append(document.createElement(name));
    document.body.append(p.root);
    await flush();
    setElementProps(p.content, { side: 'left' });
    await flush();
    expect(p.root.isConnected).toBe(false);
    const count = calls;
    await flush();
    expect(calls).toBe(count);
  });
});
