import { AdaptToWebComponent } from '../src';
import { createContextKey, definePrototype } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';
import {
  contextAdapterConformance,
  type ContextTree,
} from '../../base/test/fixtures/context-conformance';

contextAdapterConformance('wc', async (tree) => {
  const host = document.createElement('div');
  const render = (node: ContextTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.append(...(node.children ?? []).map(render));
    return el;
  };
  host.append(...tree.map(render));
  document.body.append(host);
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    flush,
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
});

describe('wc: failed Context initialization ownership', () => {
  it('ignores obsolete connected callbacks before the actual provider insertion', async () => {
    const key = createContextKey<{ value: number }>('wc-obsolete-connected');
    let setups = 0;
    const child = definePrototype({
      name: 'x-wc-obsolete-connected-child',
      setup(def) {
        setups++;
        def.context.subscribe(key);
        return (r) => r.el('span', String(r.read.context.read(key).value));
      },
    });
    const provider = definePrototype({
      name: 'x-wc-obsolete-connected-provider',
      setup(def) {
        def.context.provide(key, { value: 13 });
        return (r) => r.slot();
      },
    });
    const Child = AdaptToWebComponent(child);
    AdaptToWebComponent(provider);
    const element = new Child() as InstanceType<typeof Child> & { connectedCallback(): void };
    element.connectedCallback();
    expect(setups).toBe(0);
    expect(element.hasAttribute('data-pui-root')).toBe(false);
    const parent = document.createElement(provider.name);
    parent.append(element);
    try {
      document.body.append(parent);
      for (let i = 0; i < 8; i++) await Promise.resolve();
      expect(element.querySelector('span')?.textContent).toBe('13');
      expect(setups).toBe(1);
    } finally {
      parent.remove();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
  });

  it('rolls back the failed shell and acquires a fresh owner under a real provider', async () => {
    const key = createContextKey<{ value: number }>('wc-failed-initialization');
    const calls = { setup: 0, created: 0, disposed: 0 };
    const child = definePrototype({
      name: 'x-wc-failed-init-child',
      setup(def) {
        calls.setup++;
        def.context.subscribe(key);
        def.lifecycle.onCreated(() => {
          calls.created++;
        });
        def.lifecycle.onBeforeDispose(() => {
          calls.disposed++;
        });
        return (r) => r.el('span', String(r.read.context.read(key).value));
      },
    });
    const provider = definePrototype({
      name: 'x-wc-failed-init-provider',
      setup(def) {
        def.context.provide(key, { value: 7 });
        return (r) => r.slot();
      },
    });
    const Child = AdaptToWebComponent(child);
    AdaptToWebComponent(provider);
    const element = new Child() as InstanceType<typeof Child> & { connectedCallback(): void };
    element.className = 'consumer-class';
    let error: unknown;
    try {
      document.body.append(element);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'CONTEXT_PROVIDER_MISSING' });
    expect(element.hasAttribute('data-pui-root')).toBe(false);
    expect(element.className).toBe('consumer-class');
    expect(calls).toEqual({ setup: 1, created: 0, disposed: 0 });

    const parent = document.createElement(provider.name);
    parent.append(element);
    try {
      // No intervening disconnect turn may rescue a failed mountedOnce shortcut.
      document.body.append(parent);
      for (let i = 0; i < 8; i++) await Promise.resolve();
      expect(element.querySelector('span')?.textContent).toBe('7');
      expect(element.getAttribute('data-pui-root')).toBe('');
      expect(calls).toEqual({ setup: 2, created: 1, disposed: 0 });
    } finally {
      parent.remove();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    expect(calls.disposed).toBe(1);
  });

  it('restores a consumer-owned Root marker when required Context rejects', () => {
    const key = createContextKey<{ value: number }>('wc-failed-consumer-marker');
    const proto = definePrototype({
      name: 'x-wc-failed-consumer-marker',
      setup(def) {
        def.context.subscribe(key);
      },
    });
    const Ctor = AdaptToWebComponent(proto);
    const element = new Ctor() as InstanceType<typeof Ctor> & { connectedCallback(): void };
    element.setAttribute('data-pui-root', 'consumer');
    let error: unknown;
    try {
      document.body.append(element);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'CONTEXT_PROVIDER_MISSING' });
    expect(element.getAttribute('data-pui-root')).toBe('consumer');
    element.remove();
  });
});
