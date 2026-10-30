import { definePrototype } from '@proto.ui/core';
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
      await vi.waitFor(() => expect(inputHost.querySelector('input')).not.toBeNull());
      const input = inputHost.querySelector('input')!;
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
      expect(inputHost.querySelector('input')).toBe(input);
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
      expect(portal.getAttribute('data-demo-owner')).toBe(
        ctx.refs.shell.getAttribute('data-demo-owner')
      );
      await api.setChildren!('actions', []);
      await vi.waitFor(() => expect(portal.isConnected).toBe(false));
      expect(ctx.refs.portaled).toBeUndefined();
      expect(ctx.refs.portalAction).toBeUndefined();
      expect(api.getExposes('portalAction')).toBeUndefined();
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
      api.setSurfaceStyle!('styled', '');
      api.setProps('styled', { disabled: true });
      await vi.waitFor(() => {
        expect(api.call('styled', 'disabled.get')).toBe(true);
        expect(element.style.getPropertyValue('--dynamic-string')).toBe('');
        expect(element.style.getPropertyValue('--dynamic-object')).toBe('');
        expect(element.style.getPropertyValue('--dynamic-original')).toBe('');
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
