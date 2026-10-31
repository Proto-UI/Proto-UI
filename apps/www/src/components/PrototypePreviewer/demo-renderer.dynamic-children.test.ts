import { createControlLabelRef, definePrototype } from '@proto.ui/core';
import { asControlLabel } from '@proto.ui/hooks';
import {
  getElementAssociations,
  setElementAssociations,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderDemo, revokeFailedDemoRender } from './demo-renderer';
import { claimHostMount } from './runtimes/host-mount';
import { registerPrototype } from './registry';
import {
  commandRoot,
  commandInput,
  commandContent,
  commandItem,
} from '@proto.ui/prototypes-base/command';
import { dialogRoot, dialogContent, dialogTitle } from '@proto.ui/prototypes-base/dialog';
import { button } from '@proto.ui/prototypes-base/button';
import type { DemoKeyedChild, DemoSetupContext } from './demo-types';
// Only CDN acquisition is replaced. Frameworks, adapters, the renderer and
// Button are real installed implementations; this is host-unit, not browser evidence.
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/react/package.json'));
  return {
    ...actual,
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});

const views: Array<{ destroy(): void | Promise<void> }> = [];
beforeAll(() => {
  for (const proto of [
    commandRoot,
    commandInput,
    commandContent,
    commandItem,
    button,
    dialogRoot,
    dialogContent,
    dialogTitle,
  ])
    registerPrototype(proto.name, proto);
});
afterEach(async () => {
  for (const view of views.splice(0).reverse()) await view.destroy();
  document.body.replaceChildren();
});
const result = (key: string): DemoKeyedChild => ({
  key,
  node: {
    kind: 'proto',
    prototypeId: commandItem.name,
    ref: key,
    props: { value: key, textValue: key },
    children: [key],
  },
});
const action = (key: string): DemoKeyedChild => ({
  key,
  node: {
    kind: 'proto',
    prototypeId: button.name,
    ref: key,
    props: { disabled: false },
    children: [key],
  },
});
async function mount(runtime: 'wc' | 'react' | 'vue' | 'vue2') {
  const host = document.createElement('div');
  document.body.append(host);
  let ctx!: DemoSetupContext;
  const view = await renderDemo({
    runtime,
    host,
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'shell',
        children: [
          {
            kind: 'proto',
            prototypeId: commandRoot.name,
            ref: 'command',
            props: { filter: false },
            children: [
              {
                kind: 'proto',
                prototypeId: commandInput.name,
                ref: 'editor',
                props: { a11yLabel: 'Query' },
              },
              {
                kind: 'proto',
                prototypeId: commandContent.name,
                ref: 'list',
                children: [
                  {
                    kind: 'box',
                    ref: 'results',
                    dynamicChildren: { prototypeIds: [commandItem.name] },
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            ref: 'actions',
            dynamicChildren: {
              prototypeIds: [button.name, dialogRoot.name, dialogContent.name, dialogTitle.name],
            },
            children: [],
          },
        ],
      },
      setup(context) {
        ctx = context;
      },
    },
  });
  views.push(view);
  return { host, view, ctx, api: ctx.api };
}

// Installed frameworks + actual adapters, no mocked component/focus/commit layer.
// Synthetic DOM only: not a claim of native IME, keyboard order or viewport acceptance.
describe.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s public dynamic composition',
  (runtime) => {
    it('retains Root/Input and keyed items through append/reorder/remove, publishing live refs', async () => {
      const { ctx, api } = await mount(runtime);
      const root = ctx.refs.command,
        inputHost = ctx.refs.editor;
      const editor = () =>
        inputHost.matches('input')
          ? (inputHost as HTMLInputElement)
          : inputHost.querySelector('input');
      await vi.waitFor(() => expect(editor()).not.toBeNull());
      const input = editor()!;
      expect(input.tagName).toBe('INPUT');
      input.focus();
      input.value = 'retained';
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'retained' })
      );
      input.setSelectionRange(2, 4);
      await expect(api.setChildren!('results', [result('a'), result('b')])).resolves.toBe(
        'committed'
      );
      const a = ctx.refs.a,
        b = ctx.refs.b;
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      await expect(
        api.setChildren!('results', [result('b'), result('a'), result('c')])
      ).resolves.toBe('committed');
      expect(ctx.refs.command).toBe(root);
      expect(ctx.refs.editor).toBe(inputHost);
      expect(editor()).toBe(input);
      expect(ctx.refs.a).toBe(a);
      expect(ctx.refs.b).toBe(b);
      expect([...ctx.refs.results.children].map((el) => el.getAttribute('data-demo-ref'))).toEqual([
        'b',
        'a',
        'c',
      ]);
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(4);
      await vi.waitFor(() => expect(api.call('command', 'visibleCount.get')).toBe(3));
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
      );
      await vi.waitFor(() => expect(api.call('b', 'active.get')).toBe(true));
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      );
      await vi.waitFor(() => expect(api.call('a', 'active.get')).toBe(true));
      await api.setChildren!('results', [result('b')]);
      expect(ctx.refs.a).toBeUndefined();
      expect(api.getExposes('a')).toBeUndefined();
      expect(ctx.refs.b).toBe(b);
      await vi.waitFor(() => expect(api.call('b', 'active.get')).toBe(true));
      await api.setChildren!('results', []);
      expect(ctx.refs.b).toBeUndefined();
      expect(ctx.refs.results.children).toHaveLength(0);
    }, 20_000);

    it('retains imperative callbacks/surface styles on keyed update and retires them on replacement', async () => {
      const { ctx, api } = await mount(runtime);
      await api.setChildren!('actions', [action('run')]);
      await vi.waitFor(() => expect(typeof api.getExposes('run')?.focusSelf).toBe('function'));
      const first = ctx.refs.run,
        click = vi.fn();
      api.setProps('run', { onClick: click });
      api.setSurfaceStyle!('run', { color: 'rgb(1, 2, 3)' });
      await api.setChildren!('actions', [action('run')]);
      expect(ctx.refs.run).toBe(first);
      await vi.waitFor(() => expect(first.style.color).toBe('rgb(1, 2, 3)'));
      first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(click).toHaveBeenCalledTimes(1);
      await api.setChildren!('actions', [
        { key: 'run', node: { kind: 'box', ref: 'run', children: ['Replacement'] } },
      ]);
      expect(ctx.refs.run).not.toBe(first);
      expect(api.getExposes('run')).toBeUndefined();
      first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(click).toHaveBeenCalledTimes(1);
      await api.setChildren!('actions', [action('run')]);
      ctx.refs.run.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(click).toHaveBeenCalledTimes(1);
    }, 20_000);

    it('tracks portaled public Dialog refs and removes their DOM/resources with the dynamic owner', async () => {
      const { ctx, api, host } = await mount(runtime);
      await api.setChildren!('actions', [
        {
          key: 'dialog',
          node: {
            kind: 'proto',
            prototypeId: dialogRoot.name,
            ref: 'dynamicDialog',
            props: { open: true },
            children: [
              {
                kind: 'proto',
                prototypeId: dialogContent.name,
                ref: 'portaled',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: dialogTitle.name,
                    ref: 'portalTitle',
                    children: ['Dynamic title'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: button.name,
                    ref: 'portalAction',
                    children: ['Inside'],
                  },
                ],
              },
            ],
          },
        },
      ]);
      await vi.waitFor(() => expect(ctx.refs.portaled?.isConnected).toBe(true));
      const portal = ctx.refs.portaled;
      await vi.waitFor(() => expect(host.contains(portal)).toBe(false));
      expect(ctx.refs.shell.getAttribute('data-demo-owner')).toMatch(/^demo-/);
      const owner = ctx.refs.shell.getAttribute('data-demo-owner');
      if (runtime === 'wc') expect(portal.getAttribute('data-demo-owner')).toBe(owner);
      else expect(portal.classList.contains(`pui-owner-${owner}`)).toBe(true);
      await api.setChildren!('actions', []);
      await vi.waitFor(() => expect(portal.isConnected).toBe(false));
      expect(ctx.refs.portaled).toBeUndefined();
      expect(ctx.refs.portalAction).toBeUndefined();
      expect(api.getExposes('portalAction')).toBeUndefined();
    }, 20_000);

    it('isolates identical refs in two trees and retains ownership through host-class updates and retirement', async () => {
      const first = await mount(runtime);
      const second = await mount(runtime);
      const firstRoot = first.ctx.refs.command;
      const secondRoot = second.ctx.refs.command;
      expect(firstRoot).toBeDefined();
      expect(secondRoot).toBeDefined();
      expect(firstRoot).not.toBe(secondRoot);
      await first.api.setChildren!('actions', [action('same')]);
      await second.api.setChildren!('actions', [action('same')]);
      const firstItem = first.ctx.refs.same;
      const secondItem = second.ctx.refs.same;
      expect(firstItem).toBeDefined();
      expect(secondItem).toBeDefined();
      expect(firstItem).not.toBe(secondItem);
      expect(first.host.contains(firstItem)).toBe(true);
      expect(second.host.contains(secondItem)).toBe(true);
      const hostClass = runtime === 'react' ? 'hostClassName' : 'hostClass';
      const authoredClass =
        runtime === 'react' || runtime === 'wc'
          ? 'authored-host'
          : ['authored-host', { 'authored-object': true, 'authored-disabled': false }];
      first.api.setProps('same', { [hostClass]: authoredClass });
      const owner = first.ctx.refs.shell.getAttribute('data-demo-owner');
      const assertIdentity = () => {
        expect(first.ctx.refs.same).toBe(firstItem);
        expect(second.ctx.refs.same).toBe(secondItem);
        if (runtime === 'wc') expect(firstItem.getAttribute('data-demo-owner')).toBe(owner);
        else expect(firstItem.classList.contains(`pui-owner-${owner}`)).toBe(true);
      };
      await vi.waitFor(() => {
        assertIdentity();
        if (runtime !== 'wc') expect(firstItem.classList.contains('authored-host')).toBe(true);
      });
      await first.api.setChildren!('actions', [action('same'), action('next')]);
      expect(first.ctx.refs.same).toBe(firstItem);
      expect(second.ctx.refs.same).toBe(secondItem);
      if (runtime !== 'wc') {
        expect(firstItem.classList.contains('authored-host')).toBe(true);
        if (runtime !== 'react') {
          expect(firstItem.classList.contains('authored-object')).toBe(true);
          expect(firstItem.classList.contains('authored-disabled')).toBe(false);
        }
      }
      first.api.setProps('same', { [hostClass]: '' });
      await vi.waitFor(() => {
        assertIdentity();
        if (runtime !== 'wc') expect(firstItem.classList.contains('authored-host')).toBe(false);
      });
      await first.api.setChildren!('actions', [action('same')]);
      expect(first.ctx.refs.same).toBe(firstItem);
      if (runtime !== 'wc') expect(firstItem.classList.contains('authored-host')).toBe(false);
      const retired = first.api.setChildren!('actions', [action('late')]);
      await first.view.destroy();
      await expect(retired).resolves.toBe('disposed');
      expect(first.ctx.refs.same).toBeUndefined();
      expect(firstItem.isConnected).toBe(false);
      await second.api.setChildren!('actions', [action('same'), action('live')]);
      expect(second.ctx.refs.same).toBe(secondItem);
      expect(second.ctx.refs.live).toBeDefined();
      expect(secondItem.isConnected).toBe(true);
      expect(second.ctx.refs.late).toBeUndefined();
    }, 20_000);

    it('keeps two same-named portals in their own generations after one is removed and rebuilt', async () => {
      const first = await mount(runtime);
      const second = await mount(runtime);
      const dialog = (): DemoKeyedChild => ({
        key: 'dialog',
        node: {
          kind: 'proto',
          prototypeId: dialogRoot.name,
          ref: 'dialog',
          props: { open: true },
          children: [
            {
              kind: 'proto',
              prototypeId: dialogContent.name,
              ref: 'portal',
              children: [
                { kind: 'proto', prototypeId: dialogTitle.name, ref: 'title', children: ['Title'] },
              ],
            },
          ],
        },
      });
      await first.api.setChildren!('actions', [dialog()]);
      await second.api.setChildren!('actions', [dialog()]);
      await vi.waitFor(() => {
        expect(first.ctx.refs.portal?.isConnected).toBe(true);
        expect(second.ctx.refs.portal?.isConnected).toBe(true);
        expect(first.host.contains(first.ctx.refs.portal)).toBe(false);
        expect(second.host.contains(second.ctx.refs.portal)).toBe(false);
      });
      const firstPortal = first.ctx.refs.portal;
      const secondPortal = second.ctx.refs.portal;
      expect(firstPortal).not.toBe(secondPortal);
      for (const [current, other] of [
        [first, second],
        [second, first],
      ]) {
        const own = current.ctx.refs.shell.getAttribute('data-demo-owner');
        const foreign = other.ctx.refs.shell.getAttribute('data-demo-owner');
        expect(own).not.toBe(foreign);
        if (runtime === 'wc')
          expect(current.ctx.refs.portal.getAttribute('data-demo-owner')).toBe(own);
        else {
          expect(current.ctx.refs.portal.classList.contains(`pui-owner-${own}`)).toBe(true);
          expect(current.ctx.refs.portal.classList.contains(`pui-owner-${foreign}`)).toBe(false);
        }
      }
      await first.api.setChildren!('actions', []);
      expect(first.ctx.refs.portal).toBeUndefined();
      expect(firstPortal.isConnected).toBe(false);
      expect(second.ctx.refs.portal).toBe(secondPortal);
      await first.api.setChildren!('actions', [dialog()]);
      await vi.waitFor(() => expect(first.ctx.refs.portal?.isConnected).toBe(true));
      expect(first.ctx.refs.portal).not.toBe(firstPortal);
      expect(first.ctx.refs.portal).not.toBe(secondPortal);
      expect(second.ctx.refs.portal).toBe(secondPortal);
      await first.view.destroy();
      expect(secondPortal.isConnected).toBe(true);
      expect(second.ctx.refs.portal).toBe(secondPortal);
    }, 20_000);

    it('rejects invalid updates without destroying the existing tree, coalesces queued work, and disposes refs', async () => {
      const { ctx, api, view } = await mount(runtime);
      await api.setChildren!('results', [result('stable')]);
      const stable = ctx.refs.stable;
      await expect(api.setChildren!('results', [result('x'), result('x')])).rejects.toThrow(
        /duplicate key/
      );
      expect(ctx.refs.stable).toBe(stable);
      const old = api.setChildren!('results', [result('old')]);
      const latest = api.setChildren!('results', [result('latest')]);
      await expect(old).resolves.toBe('superseded');
      await expect(latest).resolves.toBe('committed');
      expect(ctx.refs.old).toBeUndefined();
      expect(ctx.refs.latest).toBeDefined();
      const pending = api.setChildren!('results', [result('never')]);
      await view.destroy();
      await expect(pending).resolves.toBe('disposed');
      expect(Object.keys(ctx.refs)).toEqual([]);
      expect(api.getExposes('command')).toBeUndefined();
      await expect(api.setChildren!('results', [])).resolves.toBe('disposed');
    }, 20_000);
  }
);

// Add `import { definePrototype } from '@proto.ui/core';` above.
// Append after existing helpers/tests in demo-renderer.dynamic-children.test.ts.
describe('WC dynamic regression guards', () => {
  it('stops the remaining author inserts when mounted lifecycle reenters the same host', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    let ctx!: DemoSetupContext;
    let replacement: ReturnType<typeof renderDemo> | undefined;
    const reentered = vi.fn();
    const probe = definePrototype({
      name: 'test-demo-dynamic-wc-mounted-reentry',
      setup(def) {
        def.lifecycle.onMounted(() => {
          if (replacement) return;
          reentered();
          // Public renderer entry claims the next host lease synchronously.
          replacement = renderDemo({
            runtime: 'wc',
            host,
            demo: {
              type: 'demo',
              root: { kind: 'box', ref: 'new-generation', children: ['Replacement'] },
            },
          });
        });
      },
    });
    registerPrototype(probe.name, probe);
    const original = await renderDemo({
      runtime: 'wc',
      host,
      demo: {
        type: 'demo',
        root: {
          kind: 'box',
          ref: 'slot',
          dynamicChildren: { prototypeIds: [probe.name] },
          children: [],
        },
        setup(context) {
          ctx = context;
        },
      },
    });
    views.push(original);
    const update = ctx.api.setChildren!('slot', [
      { key: 'before', node: { kind: 'box', ref: 'old-before', children: ['Before'] } },
      { key: 'trigger', node: { kind: 'proto', prototypeId: probe.name, ref: 'old-trigger' } },
      { key: 'after', node: { kind: 'box', ref: 'old-after', children: ['After'] } },
    ]);
    // Trigger is in the middle: either forward or reverse insertion still has
    // old work remaining when it reenters. A last-entry trigger would false-pass.
    await expect(update).resolves.toBe('disposed');
    expect(reentered).toHaveBeenCalledTimes(1);
    expect(replacement).toBeDefined();
    const next = await replacement!;
    views.push(next);
    expect(host.querySelector('[data-demo-ref="new-generation"]')?.textContent).toBe('Replacement');
    expect(host.querySelector('[data-demo-ref^="old-"]')).toBeNull();
    expect(document.querySelector('[data-demo-ref="old-trigger"]')).toBeNull();
    expect(Object.keys(ctx.refs)).toEqual([]);
    // Late retirement of an obsolete render must not erase the current owner.
    await original.destroy();
    expect(host.querySelector('[data-demo-ref="new-generation"]')).not.toBeNull();
  }, 20_000);

  it.each(['null', 'omit'] as const)(
    'withdraws an imperative callback when the authored snapshot explicitly replaces its prior key: %s',
    async (mode) => {
      const { ctx, api } = await mount('wc');
      const row = (withCallbackKey: boolean): DemoKeyedChild => ({
        key: 'run',
        node: {
          kind: 'proto',
          prototypeId: button.name,
          ref: 'run',
          props: { disabled: false, ...(withCallbackKey ? { onClick: null } : {}) },
          children: ['Run'],
        },
      });
      await api.setChildren!('actions', [row(true)]);
      await vi.waitFor(() => expect(typeof api.getExposes('run')?.focusSelf).toBe('function'));
      const element = ctx.refs.run,
        callback = vi.fn();
      api.setProps('run', { onClick: callback });
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(callback).toHaveBeenCalledTimes(1);
      await api.setChildren!('actions', [row(mode === 'null')]);
      expect(ctx.refs.run).toBe(element);
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(callback).toHaveBeenCalledTimes(1);
      // Existing positive test separately preserves imperative-only keys when no
      // prior authored key was replaced/withdrawn. These are different contracts.
    },
    20_000
  );

  it('appends a sibling without moving or blurring the retained focused item when moveBefore is unavailable', async () => {
    const { ctx, api } = await mount('wc');
    await api.setChildren!('actions', [action('focused')]);
    await vi.waitFor(() => expect(typeof api.getExposes('focused')?.focusSelf).toBe('function'));
    const slot = ctx.refs.actions,
      focused = ctx.refs.focused;
    const ownMoveBefore = Object.getOwnPropertyDescriptor(slot, 'moveBefore');
    Object.defineProperty(slot, 'moveBefore', { configurable: true, value: undefined });
    const append = vi.spyOn(slot, 'appendChild');
    const insert = vi.spyOn(slot, 'insertBefore');
    try {
      api.call('focused', 'focusSelf');
      await vi.waitFor(() => expect(document.activeElement).toBe(focused));
      await api.setChildren!('actions', [action('focused'), action('new-sibling')]);
      expect(ctx.refs.focused).toBe(focused);
      expect(document.activeElement).toBe(focused);
      // The call spies make this a real regression even if the synthetic DOM
      // happens not to blur a node on unnecessary remove/reinsert.
      expect(append.mock.calls.some(([node]) => node === focused)).toBe(false);
      expect(insert.mock.calls.some(([node]) => node === focused)).toBe(false);
      expect([...slot.children].map((node) => node.getAttribute('data-demo-ref'))).toEqual([
        'focused',
        'new-sibling',
      ]);
    } finally {
      append.mockRestore();
      insert.mockRestore();
      if (ownMoveBefore) Object.defineProperty(slot, 'moveBefore', ownMoveBefore);
      else Reflect.deleteProperty(slot, 'moveBefore');
    }
  }, 20_000);
});

describe.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s reserved composition metadata',
  (runtime) => {
    it('keeps internal ref/owner authoritative on create, patch and attrs withdrawal', async () => {
      const { ctx, api } = await mount(runtime);
      const expectedOwner = ctx.refs.shell.getAttribute('data-demo-owner');
      expect(expectedOwner).toBeTruthy();
      const rows = (forged: boolean): DemoKeyedChild[] => [
        {
          key: 'named',
          node: {
            kind: 'box',
            ref: 'named',
            attrs: forged
              ? {
                  'data-demo-owner': 'foreign-owner',
                  'data-demo-ref': 'forged-name',
                }
              : {},
            children: ['Named'],
          },
        },
        {
          key: 'anonymous',
          node: {
            kind: 'box',
            attrs: forged
              ? {
                  'data-demo-owner': 'foreign-owner',
                  'data-demo-ref': 'forged-anonymous',
                }
              : {},
            children: ['Anonymous'],
          },
        },
      ];
      await api.setChildren!('actions', rows(true));
      const named = ctx.refs.named;
      expect(named).toBeDefined();
      for (const forged of [true, false, true]) {
        await api.setChildren!('actions', rows(forged));
        expect(ctx.refs.named).toBe(named);
        expect(named.getAttribute('data-demo-ref')).toBe('named');
        expect(named.getAttribute('data-demo-owner')).toBe(expectedOwner);
        const anonymous = ctx.refs.actions.children[1];
        expect(anonymous.getAttribute('data-demo-ref')).toBeNull();
        expect(anonymous.getAttribute('data-demo-owner')).toBe(expectedOwner);
        expect(ctx.refs['forged-name']).toBeUndefined();
        expect(ctx.refs['forged-anonymous']).toBeUndefined();
      }
    }, 20_000);
  }
);

// Append to the existing four-runtime actual-adapter test file; uses button,
// views, renderDemo and DemoSetupContext already imported there.
describe.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s static theme compatibility',
  (runtime) => {
    it('does not restore a stale cloned theme after a later ordinary host props commit', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const rendererOwnedTheme = { '--pui-background': '#ffffff', '--pui-foreground': '#111111' };
      let ctx!: DemoSetupContext;
      const view = await renderDemo({
        runtime,
        host,
        demo: {
          type: 'demo',
          root: {
            kind: 'proto',
            prototypeId: button.name,
            ref: 'staticButton',
            surfaceStyle: rendererOwnedTheme,
            children: ['Static'],
          },
          setup(context) {
            ctx = context;
          },
        },
      });
      views.push(view);
      await vi.waitFor(() =>
        expect(typeof ctx.api.getExposes('staticButton')?.focusSelf).toBe('function')
      );
      const element = ctx.refs.staticButton;
      expect(element.style.getPropertyValue('--pui-background')).toBe('#ffffff');
      // Same mutable renderer-owned theme-entry operation as
      // projection-composition.updateRendererThemeSurfaceStyles.
      Object.assign(rendererOwnedTheme, {
        '--pui-background': '#090909',
        '--pui-foreground': '#f4f4f5',
      });
      ctx.api.setProps('staticButton', { disabled: true });
      await vi.waitFor(() => {
        expect(ctx.api.call('staticButton', 'disabled.get')).toBe(true);
        expect(element.style.getPropertyValue('--pui-background')).toBe('#090909');
        expect(element.style.getPropertyValue('--pui-foreground')).toBe('#f4f4f5');
      });
      expect(ctx.refs.staticButton).toBe(element);
      // A second unrelated update must not revive the admission snapshot either.
      ctx.api.setProps('staticButton', { disabled: false });
      await vi.waitFor(() => expect(ctx.api.call('staticButton', 'disabled.get')).toBe(false));
      expect(element.style.getPropertyValue('--pui-background')).toBe('#090909');
    }, 20_000);
  }
);

// Uses definePrototype import plus existing test helpers; synthetic-host evidence
// only until the same scenario has run in a real browser. No Adapter private hooks.
it('WC fallback keyed reorder retains the actual Proto setup identity and internal state', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  let setupCount = 0,
    disposedCount = 0;
  const probe = definePrototype({
    name: 'test-demo-dynamic-wc-reorder-owner',
    setup(def) {
      const instanceIdentity = ++setupCount;
      const touched = def.state.bool('touched', false);
      def.expose.state('touched', touched);
      def.expose.method('identity', () => instanceIdentity);
      def.expose.method('touch', () => touched.set(true, 'reason: dynamic reorder test'));
      def.lifecycle.onBeforeDispose(() => {
        disposedCount++;
      });
    },
  });
  registerPrototype(probe.name, probe);
  let ctx!: DemoSetupContext;
  const view = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'slot',
        dynamicChildren: { prototypeIds: [probe.name] },
        children: [],
      },
      setup(context) {
        ctx = context;
      },
    },
  });
  views.push(view);
  const row = (key: string): DemoKeyedChild => ({
    key,
    node: { kind: 'proto', prototypeId: probe.name, ref: key },
  });
  await ctx.api.setChildren!('slot', [row('a'), row('b')]);
  await vi.waitFor(() => expect(typeof ctx.api.getExposes('a')?.identity).toBe('function'));
  const a = ctx.refs.a,
    b = ctx.refs.b;
  const identityA = ctx.api.call('a', 'identity'),
    identityB = ctx.api.call('b', 'identity');
  ctx.api.call('a', 'touch');
  expect(ctx.api.call('a', 'touched.get')).toBe(true);
  expect(setupCount).toBe(2);
  const slot = ctx.refs.slot;
  const descriptor = Object.getOwnPropertyDescriptor(slot, 'moveBefore');
  Object.defineProperty(slot, 'moveBefore', { configurable: true, value: undefined });
  try {
    await ctx.api.setChildren!('slot', [row('b'), row('a')]);
    // Allow the Adapter's actual disconnect checkpoint to run; DOM identity by
    // itself would miss a terminal owner teardown/rematerialization on that node.
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    expect([...slot.children]).toEqual([b, a]);
    expect(ctx.api.call('a', 'identity')).toBe(identityA);
    expect(ctx.api.call('b', 'identity')).toBe(identityB);
    expect(ctx.api.call('a', 'touched.get')).toBe(true);
    expect(setupCount).toBe(2);
    expect(disposedCount).toBe(0);
    await ctx.api.setChildren!('slot', []);
    await vi.waitFor(() => expect(disposedCount).toBe(2));
    expect(ctx.api.getExposes('a')).toBeUndefined();
  } finally {
    if (descriptor) Object.defineProperty(slot, 'moveBefore', descriptor);
    else Reflect.deleteProperty(slot, 'moveBefore');
  }
}, 20_000);

it('WC repeated 174-row author snapshots do not request 174 redundant retained-item updates', async () => {
  const { ctx, api } = await mount('wc');
  const rows = () => Array.from({ length: 174 }, (_, index) => result(`row-${index}`));
  await api.setChildren!('results', rows());
  const elements = rows().map(({ key }) => ctx.refs[key]!);
  const editor = ctx.refs.editor.matches('input')
    ? (ctx.refs.editor as HTMLInputElement)
    : ctx.refs.editor.querySelector('input')!;
  editor.focus();
  editor.value = 'se';
  editor.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'se' })
  );
  editor.setSelectionRange(1, 2);
  const instances = elements.map((element) =>
    api.getPublicInstance!(element.getAttribute('data-demo-ref')!)
  );
  expect(instances.every(Boolean)).toBe(true);
  const updates = elements.map((element) =>
    vi.spyOn(element as HTMLElement & { update(): void }, 'update')
  );
  try {
    await expect(api.setChildren!('results', rows())).resolves.toBe('committed');
    expect(updates.reduce((count, update) => count + update.mock.calls.length, 0)).toBe(0);
    expect(rows().map(({ key }) => ctx.refs[key])).toEqual(elements);
    expect(rows().map(({ key }) => api.getPublicInstance!(key))).toEqual(instances);
    expect(document.activeElement).toBe(editor);
    expect(editor.value).toBe('se');
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([1, 2]);

    const changed = rows();
    const changedNode = changed[83]!.node;
    if (typeof changedNode === 'string' || changedNode.kind !== 'proto')
      throw new Error('Expected a real Command Item');
    changedNode.props = { ...changedNode.props, textValue: 'updated result' };
    changed.push(result('row-174'));
    await expect(api.setChildren!('results', changed)).resolves.toBe('committed');
    expect(updates.map((update) => update.mock.calls.length)).toEqual(
      Array.from({ length: 174 }, (_, index) => (index === 83 ? 1 : 0))
    );
    expect(updates[83]!.mock.contexts).toEqual([elements[83]]);
    expect(ctx.refs['row-174']).toBeDefined();
    expect(rows().map(({ key }) => ctx.refs[key])).toEqual(elements);
    expect(document.activeElement).toBe(editor);
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([1, 2]);
  } finally {
    for (const update of updates) update.mockRestore();
  }
}, 20_000);

it('WC no-op suppression preserves changed children, scalar presence, Object.is and object-identity updates', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const watched: unknown[][] = [];
  let setupCount = 0;
  const probe = definePrototype({
    name: 'test-demo-dynamic-wc-noop-props',
    setup(def) {
      setupCount++;
      def.props.define({ value: { type: 'number' }, payload: { type: 'object' } });
      def.props.watchAll((_run, next, previous) => {
        watched.push([previous.value, next.value, previous.payload, next.payload]);
      });
    },
  });
  registerPrototype(probe.name, probe);
  let ctx!: DemoSetupContext;
  const view = await renderDemo({
    host,
    runtime: 'wc',
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'slot',
        dynamicChildren: { prototypeIds: [probe.name] },
        children: [],
      },
      setup(context) {
        ctx = context;
      },
    },
  });
  views.push(view);
  const row = (props: Record<string, unknown>, text = 'original'): DemoKeyedChild => ({
    key: 'stable',
    node: { kind: 'proto', prototypeId: probe.name, ref: 'stable', props, children: [text] },
  });
  await ctx.api.setChildren!('slot', [row({ value: 0 })]);
  const element = ctx.refs.stable as HTMLElement & { update(): void };
  const update = vi.spyOn(element, 'update');
  try {
    watched.length = 0;
    await ctx.api.setChildren!('slot', [row({ value: 0 })]);
    expect(update).not.toHaveBeenCalled();
    expect(watched).toEqual([]);

    await ctx.api.setChildren!('slot', [row({ value: -0 })]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(watched).toHaveLength(1);
    expect(Object.is(watched[0]![0], 0)).toBe(true);
    expect(Object.is(watched[0]![1], -0)).toBe(true);
    update.mockClear();

    await ctx.api.setChildren!('slot', [row({ value: -0 }, 'changed child')]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('changed child');
    expect(watched).toHaveLength(1); // Children changes are not props diffs.
    update.mockClear();

    await ctx.api.setChildren!('slot', [row({}, 'changed child')]);
    expect(update).toHaveBeenCalledTimes(1); // Withdrawal is not the old scalar value.
    update.mockClear();

    await ctx.api.setChildren!('slot', [row({ payload: { nested: { value: 1 } } })]);
    update.mockClear();
    const beforeObjectReplay = watched.length;
    await ctx.api.setChildren!('slot', [row({ payload: { nested: { value: 1 } } })]);
    expect(update).toHaveBeenCalledTimes(1); // Equal-looking object is a new prop identity.
    expect(watched.length).toBeGreaterThan(beforeObjectReplay);
    update.mockClear();
    await ctx.api.setChildren!('slot', [row({ payload: { nested: { value: 2 } } })]);
    expect(update).toHaveBeenCalledTimes(1);
    update.mockClear();

    // The existing author-data admission rejects NaN; the optimization must not
    // bypass it or partially mutate the committed element/props.
    await expect(ctx.api.setChildren!('slot', [row({ value: Number.NaN })])).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(ctx.refs.stable).toBe(element);
    expect(setupCount).toBe(1);
  } finally {
    update.mockRestore();
  }
}, 20_000);

it('WC retained no-op checks keep mutable imperative props, surface sync and public update available', async () => {
  const { ctx, api } = await mount('wc');
  await api.setChildren!('actions', [action('stable')]);
  const element = ctx.refs.stable as HTMLElement & { update(): void };
  const callback = vi.fn();
  const payload = { nested: { value: 1 } };
  const surface = { '--retained-surface': 'old' };
  api.setProps('stable', { onClick: callback, diagnosticPayload: payload });
  api.setSurfaceStyle!('stable', surface);
  const update = vi.spyOn(element, 'update');
  try {
    payload.nested.value = 2;
    surface['--retained-surface'] = 'new';
    await api.setChildren!('actions', [action('stable')]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.contexts).toEqual([element]);
    expect(element.style.getPropertyValue('--retained-surface')).toBe('new');
    element.click();
    expect(callback).toHaveBeenCalledTimes(1);
    update.mockClear();
    // Explicit callers still own their update intent; it is not suppressed.
    element.update();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.contexts).toEqual([element]);
  } finally {
    update.mockRestore();
  }
}, 20_000);

it('WC retained updates preserve association and scalar surface changes without changing receiver identity', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const probe = definePrototype({
    name: 'test-demo-dynamic-wc-noop-association',
    setup() {
      asControlLabel().target(() => {});
    },
  });
  registerPrototype(probe.name, probe);
  let ctx!: DemoSetupContext;
  const view = await renderDemo({
    host,
    runtime: 'wc',
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'actions',
        dynamicChildren: { prototypeIds: [probe.name] },
        children: [],
      },
      setup(context) {
        ctx = context;
      },
    },
  });
  views.push(view);
  const { api } = ctx;
  const row = (
    label: string,
    className = 'first',
    surfaceStyle = 'color: red'
  ): DemoKeyedChild => ({
    key: 'stable',
    node: {
      kind: 'proto',
      prototypeId: probe.name,
      ref: 'stable',
      associations: { controlLabel: label },
      className,
      surfaceStyle,
      children: ['stable'],
    },
  });
  await api.setChildren!('actions', [row('first-label')]);
  const element = ctx.refs.stable as HTMLElement & { update(): void };
  const update = vi.spyOn(element, 'update');
  try {
    await api.setChildren!('actions', [row('first-label')]);
    expect(update).not.toHaveBeenCalled();
    await api.setChildren!('actions', [row('second-label')]);
    expect(update).toHaveBeenCalledTimes(1);
    await api.setChildren!('actions', [row('second-label', 'second')]);
    expect(update).toHaveBeenCalledTimes(2);
    await api.setChildren!('actions', [row('second-label', 'second', 'color: blue')]);
    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.contexts).toEqual([element, element, element]);
    expect(ctx.refs.stable).toBe(element);
    expect(element.classList.contains('second')).toBe(true);
    expect(element.style.color).toBe('blue');
  } finally {
    update.mockRestore();
  }
}, 20_000);

it('WC identical authored rows still render after public Adapter props or associations diverge', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const probe = definePrototype<{ value: string }>({
    name: 'test-demo-dynamic-wc-noop-public-adapter',
    setup(def) {
      def.props.define({ value: { type: 'string' } });
      asControlLabel().target(() => {});
      return (renderer) => renderer.el('span', renderer.read.props.get().value);
    },
  });
  registerPrototype(probe.name, probe);
  let ctx!: DemoSetupContext;
  const view = await renderDemo({
    host,
    runtime: 'wc',
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'slot',
        dynamicChildren: { prototypeIds: [probe.name] },
        children: [],
      },
      setup(context) {
        ctx = context;
      },
    },
  });
  views.push(view);
  const row = (): DemoKeyedChild => ({
    key: 'stable',
    node: {
      kind: 'proto',
      prototypeId: probe.name,
      ref: 'stable',
      props: { value: 'authored' },
      associations: { controlLabel: 'authored-label' },
    },
  });
  await ctx.api.setChildren!('slot', [row()]);
  const element = ctx.refs.stable as HTMLElement & { update(): void };
  await vi.waitFor(() => expect(element.textContent).toBe('authored'));
  const authoredAssociation = getElementAssociations(element).controlLabel;
  setElementProps(element, { value: 'external' });
  element.update();
  await vi.waitFor(() => expect(element.textContent).toBe('external'));
  const update = vi.spyOn(element, 'update');
  try {
    await ctx.api.setChildren!('slot', [row()]);
    expect(update).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(element.textContent).toBe('authored'));
    update.mockClear();
    setElementAssociations(element, { controlLabel: createControlLabelRef() });
    await ctx.api.setChildren!('slot', [row()]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(getElementAssociations(element).controlLabel).toBe(authoredAssociation);
    expect(update.mock.contexts).toEqual([element]);
    expect(ctx.refs.stable).toBe(element);
  } finally {
    update.mockRestore();
  }
}, 20_000);

describe.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s normalized dynamic surface styles',
  (runtime) => {
    it('preserves string and mixed overrides and treats an empty string as an explicit clear', async () => {
      const { ctx, api } = await mount(runtime);
      const child = action('styled');
      if (typeof child.node === 'string' || child.node.kind !== 'proto')
        throw new Error('Expected Proto');
      child.node.surfaceStyle = { '--dynamic-original': 'original' };
      await api.setChildren!('actions', [child]);
      const element = ctx.refs.styled;
      api.setSurfaceStyle!('styled', '--dynamic-string: string');
      await vi.waitFor(() =>
        expect(element.style.getPropertyValue('--dynamic-string')).toBe('string')
      );
      api.setSurfaceStyle!('styled', ['--dynamic-string: mixed', { '--dynamic-object': 'object' }]);
      await vi.waitFor(() => {
        expect(element.style.getPropertyValue('--dynamic-string')).toBe('mixed');
        expect(element.style.getPropertyValue('--dynamic-object')).toBe('object');
      });
      if (runtime === 'vue' || runtime === 'vue2') {
        const map = Object.freeze({ '--dynamic-object': 'snapshot' });
        api.setSurfaceStyle!('styled', [
          'color: rgb(1, 2, 3) !important; --dynamic-string: ordered',
          map,
        ]);
        await vi.waitFor(() => {
          expect(element.style.getPropertyValue('--dynamic-string')).toBe('ordered');
          expect(element.style.getPropertyValue('--dynamic-object')).toBe('snapshot');
          expect(element.style.getPropertyPriority('color')).toBe('important');
        });
        expect(map).toEqual({ '--dynamic-object': 'snapshot' });
        // Both author forms name the same CSS property. Reverse ordering in a
        // later commit must reverse the winner, not retain two alias keys.
        api.setSurfaceStyle!('styled', [
          'font-size: 18px; background-color: rgb(1, 2, 3)',
          { fontSize: '21px', backgroundColor: 'rgb(4, 5, 6)' },
        ]);
        await vi.waitFor(() => {
          expect(element.style.fontSize).toBe('21px');
          expect(element.style.backgroundColor).toBe('rgb(4, 5, 6)');
        });
        api.setSurfaceStyle!('styled', [
          { fontSize: '21px', backgroundColor: 'rgb(4, 5, 6)' },
          'font-size: 18px; background-color: rgb(1, 2, 3)',
        ]);
        await vi.waitFor(() => {
          expect(element.style.fontSize).toBe('18px');
          expect(element.style.backgroundColor).toBe('rgb(1, 2, 3)');
        });
      }
      api.setSurfaceStyle!('styled', '');
      api.setProps('styled', { disabled: true });
      await vi.waitFor(() => {
        expect(api.call('styled', 'disabled.get')).toBe(true);
        expect(element.style.getPropertyValue('--dynamic-string')).toBe('');
        expect(element.style.getPropertyValue('--dynamic-object')).toBe('');
        expect(element.style.getPropertyValue('--dynamic-original')).toBe('');
        expect(element.style.getPropertyPriority('color')).toBe('');
      });
      expect(ctx.refs.styled).toBe(element);
    }, 20_000);
  }
);

it('preserves the initiating failure and cleanup failure while the actual host lease still clears its DOM', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const lease = claimHostMount(host);
  host.append(document.createElement('div'));
  const original = new Error('host commit failed');
  const cleanup = new Error('owned cleanup failed');
  const cleanupAttempt = vi.fn(() => {
    throw cleanup;
  });
  lease.commit(cleanupAttempt);
  let caught: unknown;
  try {
    revokeFailedDemoRender(lease, original);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AggregateError);
  expect((caught as AggregateError).errors).toEqual([original, cleanup]);
  expect((caught as AggregateError).cause).toBe(original);
  expect(cleanupAttempt).toHaveBeenCalledTimes(1);
  expect(lease.isCurrent()).toBe(false);
  expect(host.childNodes).toHaveLength(0);
  const cleanLease = claimHostMount(host);
  expect(() => revokeFailedDemoRender(cleanLease, original)).toThrow(original);
  expect(cleanLease.isCurrent()).toBe(false);
});
