import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/drawer';
import * as shadcn from '../../shadcn/src/drawer';
const roots: HTMLElement[] = [];
const counts = { created: 0, disposed: 0 };
const observe = (prototype: any) =>
  AdaptToWebComponent(prototype, {
    diagnostics: {
      onLifecycleEvent(e) {
        if (e.type === 'instance.created') counts.created++;
        if (e.type === 'instance.dispose.done') counts.disposed++;
      },
    },
  });
for (const p of [
  base.drawerRoot,
  base.drawerContent,
  base.drawerTitle,
  base.drawerDescription,
  base.drawerClose,
  base.drawerHandle,
  shadcn.drawerRoot,
])
  observe(p);
let id = 0;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((x) => x.remove());
  await flush();
  await expect.poll(() => counts.disposed).toBe(counts.created);
});
function fixture() {
  const root = document.createElement(base.drawerRoot.name);
  setElementProps(root, { defaultOpen: false });
  const content = document.createElement(base.drawerContent.name);
  setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
  root.append(content);
  roots.push(root);
  return { root, content };
}
function probe(target: Record<string, any>) {
  const name = `x-drawer-structure-probe-${++id}`;
  observe(
    definePrototype({
      name,
      setup(def) {
        def.context.subscribe(base.DRAWER_CONTEXT);
        def.lifecycle.onMounted((run) => {
          target.rootId = run.context.read(base.DRAWER_CONTEXT).rootId;
          target.headers = run.anatomy.partsOf(base.DRAWER_FAMILY, 'header');
          target.footers = run.anatomy.partsOf(base.DRAWER_FAMILY, 'footer');
        });
        return (r) => r.r.slot();
      },
    })
  );
  return document.createElement(name);
}
describe('portable Drawer structural parts', () => {
  it('exports Base structure hooks and Shadcn Footer without changing default consumers', () => {
    expect(base).toHaveProperty('drawerHeader');
    expect(base).toHaveProperty('asDrawerHeader');
    expect(base).toHaveProperty('drawerFooter');
    expect(base).toHaveProperty('asDrawerFooter');
    expect(shadcn).toHaveProperty('drawerFooter');
  });
  it.each(['header', 'footer'] as const)(
    '%s is a passive slot with no new input or expose authority',
    async (role) => {
      const prototype = base[role === 'header' ? 'drawerHeader' : 'drawerFooter'];
      expect(prototype).toBeDefined();
      observe(prototype);
      const p = fixture();
      const part = document.createElement(prototype.name) as any;
      const child = document.createElement('button');
      child.textContent = 'Existing child';
      part.append(child);
      p.content.append(part);
      document.body.append(p.root);
      await flush();
      expect(part.contains(child)).toBe(true);
      expect(part.getAttribute('role')).toBeNull();
      expect(part.getAttribute('tabindex')).toBeNull();
      expect(Object.keys(part.getExposes())).toEqual([]);
      expect(part.getAttribute('data-pui-style') ?? '').toBe('');
    }
  );
  it.each(['header', 'footer'] as const)(
    '%s hooks compose once and use existing per-Root anatomy cardinality',
    async (role) => {
      expect(base.asDrawerHeader).toBeDefined();
      const name = `x-mixed-drawer-${role}-${++id}`;
      observe(
        definePrototype({
          name,
          setup() {
            const hook = role === 'header' ? base.asDrawerHeader : base.asDrawerFooter;
            hook();
            hook();
            return (r) => r.r.slot();
          },
        })
      );
      const p = fixture(),
        facts: Record<string, any> = {};
      p.content.append(document.createElement(name), probe(facts));
      document.body.append(p.root);
      await flush();
      expect(facts.headers).toHaveLength(role === 'header' ? 1 : 0);
      expect(facts.footers).toHaveLength(role === 'footer' ? 1 : 0);
    }
  );
  it('mixed family Footer joins only its owning Root and nested Roots stay isolated', async () => {
    expect(base.drawerHeader).toBeDefined();
    expect(shadcn.drawerFooter).toBeDefined();
    observe(base.drawerHeader);
    observe(shadcn.drawerFooter);
    const outer = fixture(),
      inner = fixture(),
      a: Record<string, any> = {},
      b: Record<string, any> = {};
    outer.content.append(
      document.createElement(base.drawerHeader.name),
      document.createElement(shadcn.drawerFooter.name),
      probe(a)
    );
    inner.content.append(document.createElement(shadcn.drawerFooter.name), probe(b));
    outer.content.append(inner.root);
    document.body.append(outer.root);
    await flush();
    expect(a.rootId).not.toBe(b.rootId);
    expect(a.headers).toHaveLength(1);
    expect(a.footers).toHaveLength(1);
    expect(b.headers).toHaveLength(0);
    expect(b.footers).toHaveLength(1);
    expect(a.footers[0]).not.toBe(b.footers[0]);
    outer.root.remove();
    await flush();
    expect(counts.disposed).toBe(counts.created);
  });
  it('Shadcn Footer owns exact New York spacing without adding input semantics', async () => {
    const prototype = shadcn.drawerFooter;
    expect(prototype).toBeDefined();
    observe(prototype);
    const p = fixture(),
      part = document.createElement(prototype.name) as any;
    p.content.append(part);
    document.body.append(p.root);
    await flush();
    expect(new Set((part.getAttribute('data-pui-style') ?? '').split(/\s+/))).toEqual(
      new Set(['mt-[auto]', 'flex', 'flex-col', 'gap-2', 'p-4'])
    );
    expect(part.getAttribute('tabindex')).toBeNull();
    expect(Object.keys(part.getExposes())).toEqual([]);
  });
});

import { createRuntimeSession } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  type AnatomyPort,
} from '@proto.ui/module-anatomy';
it.each(['children-first', 'owner-first'] as const)(
  'host-neutral anatomy releases structural memberships with %s disposal',
  async (order) => {
    expect(base.drawerFooter).toBeDefined();
    const rootToken = {},
      contentToken = {},
      headerToken = {},
      footerToken = {};
    const parents = new Map<object, object | null>([
      [rootToken, null],
      [contentToken, rootToken],
      [headerToken, contentToken],
      [footerToken, contentToken],
    ]);
    const members = definePrototype({
      name: 'x-drawer-structure-neutral-root',
      setup(def) {
        def.anatomy.claim(base.DRAWER_FAMILY, { role: 'root' });
      },
    });
    const content = definePrototype({
      name: 'x-drawer-structure-neutral-content',
      setup(def) {
        def.anatomy.claim(base.DRAWER_FAMILY, { role: 'content' });
      },
    });
    const sessions: any[] = [];
    let acquired = 0,
      released = 0;
    const make = (token: object, prototype: any) => {
      const session = createRuntimeSession(prototype, {
        prototypeName: prototype.name,
        getRawProps: () => ({}),
        schedule: (t) => t(),
        commit: (_c, s) => s?.done(),
        onRuntimeReady: (w) => {
          w.attach('anatomy', [
            [ANATOMY_INSTANCE_TOKEN_CAP, token],
            [ANATOMY_PARENT_CAP, (instance: unknown) => parents.get(instance as object) ?? null],
            [ANATOMY_GET_PROTO_CAP, () => prototype],
            [ANATOMY_ROOT_TARGET_CAP, () => token],
            [
              ANATOMY_ORDER_OBSERVER_CAP,
              () => {
                acquired++;
                return () => {
                  released++;
                };
              },
            ],
          ]);
          // Styled family parts lawfully subscribe to the style scope; the
          // neutral host supplies the same instance/parent capabilities.
          w.attach('context', [
            [CONTEXT_INSTANCE_TOKEN_CAP, token],
            [CONTEXT_PARENT_CAP, (instance: unknown) => parents.get(instance as object) ?? null],
          ]);
        },
      });
      sessions.push(session);
      return session;
    };
    try {
      const r = make(rootToken, members);
      await r.mount();
      const c = make(contentToken, content);
      await c.mount();
      const h = make(headerToken, base.drawerHeader);
      await h.mount();
      const f = make(footerToken, shadcn.drawerFooter);
      await f.mount();
      const port = r.caps.getPort<AnatomyPort>('anatomy')!;
      expect(port.order.partsOf(base.DRAWER_FAMILY, 'header')).toHaveLength(1);
      expect(port.order.partsOf(base.DRAWER_FAMILY, 'footer')).toHaveLength(1);
      if (order === 'owner-first') {
        await r.dispose();
        expect(() => port.order.partsOf(base.DRAWER_FAMILY, 'footer')).toThrow();
      }
      await f.dispose();
      if (order === 'children-first')
        expect(port.order.partsOf(base.DRAWER_FAMILY, 'footer')).toHaveLength(0);
      await h.dispose();
      if (order === 'children-first')
        expect(port.order.partsOf(base.DRAWER_FAMILY, 'header')).toHaveLength(0);
      await c.dispose();
      await r.dispose();
      expect(acquired).toBe(released);
      expect(() => port.order.partsOf(base.DRAWER_FAMILY, 'header')).toThrow();
    } finally {
      for (const session of sessions.reverse()) await session.dispose();
    }
  }
);

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateSpecEntity } from '@proto.ui/spec-schema';
it('all slice definitions satisfy the current entity schema', () => {
  for (const path of [
    'contracts/C-DRAWER-STRUCTURE-0001',
    'tests/T-DRAWER-STRUCTURE-0001',
    'prototypes/P-BASE-DRAWER-HEADER',
    'prototypes/P-BASE-DRAWER-FOOTER',
    'prototypes/P-SHADCN-DRAWER-FOOTER',
    'prototypes/P-SHADCN-DRAWER-HEADER',
    'prototypes/P-BASE-DRAWER-ACCEPTED-SIDE',
  ])
    expect(() =>
      validateSpecEntity(parse(readFileSync(`spec/${path}.yaml`, 'utf8')))
    ).not.toThrow();
});

import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
it('Footer source mt-auto is emitted as an equivalent supported auto margin', () => {
  const tokens = ['mt-[auto]', 'flex', 'flex-col', 'gap-2', 'p-4'];
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(tokens);
    expect(css).toContain('margin-top: auto;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  }
});
