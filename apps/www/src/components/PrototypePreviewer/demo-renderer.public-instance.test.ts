import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import { button } from '@proto.ui/prototypes-base/button';
import { dialogRoot, dialogContent } from '@proto.ui/prototypes-base/dialog';
import { inputRoot } from '@proto.ui/prototypes-base/input';
import {
  inputShell,
  inputShellControl,
  bindInputShellControl,
} from '@proto.ui/prototypes-shadcn/input-shell';
import type { DemoSetupContext, DemoSpec } from './demo-types';
// Only CDN acquisition is substituted; hosts, adapters, instances and binding helper are real.
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
  for (const prototype of [
    button,
    inputShell,
    inputShellControl,
    inputRoot,
    dialogRoot,
    dialogContent,
  ])
    registerPrototype(prototype.name, prototype);
});
afterEach(async () => {
  for (const view of views.splice(0).reverse()) await view.destroy();
  document.body.replaceChildren();
});
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
async function mount(
  runtime: 'wc' | 'react' | 'vue' | 'vue2',
  host = document.createElement('div')
) {
  if (!host.isConnected) document.body.append(host);
  let context!: DemoSetupContext;
  const demo: DemoSpec = {
    type: 'demo',
    root: {
      kind: 'box',
      ref: 'box',
      children: [
        {
          kind: 'proto',
          prototypeId: inputShell.name,
          ref: 'shell',
          children: [
            {
              kind: 'proto',
              prototypeId: inputShellControl.name,
              ref: 'control',
              props: { ariaLabel: 'Query' },
            },
          ],
        },
        { kind: 'proto', prototypeId: inputShell.name, ref: 'otherShell' },
        {
          kind: 'box',
          ref: 'results',
          dynamicChildren: { prototypeIds: [button.name, inputShellControl.name, inputRoot.name] },
          children: [],
        },
      ],
    },
    setup(ctx) {
      context = ctx;
    },
  };
  const view = await renderDemo({ host, runtime, demo });
  views.push(view);
  return { host, context, view };
}
const item = (prototypeId = button.name, label = 'First') => [
  {
    key: 'stable',
    node: {
      kind: 'proto' as const,
      prototypeId,
      ref: 'item',
      props: { disabled: false },
      children: [label],
    },
  },
];

describe('actual public prototype instance lookup', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: initial synchronous listener can destroy its own render without resurrecting subscriptions`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let context!: DemoSetupContext;
      const cleanup = vi.fn();
      const demo: DemoSpec = {
        type: 'demo',
        root: { kind: 'proto', prototypeId: button.name, ref: 'control' },
        setup(ctx) {
          context = ctx;
          return cleanup;
        },
      };
      const view = await renderDemo({ host, runtime, demo });
      views.push(view);
      const events: Array<{ value: unknown; revision: number }> = [];
      const resurrected = vi.fn();
      const off = context.api.subscribePublicInstances!(['control'], (snapshot, revision) => {
        events.push({ value: snapshot.control, revision });
        if (revision === 0) view.destroy();
        else context.api.subscribePublicInstances!(['control'], resurrected);
      });
      expect(events).toHaveLength(2);
      expect(events[0].value).toBeDefined();
      expect(events[1]).toEqual({ value: undefined, revision: 1 });
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(resurrected).not.toHaveBeenCalled();
      off();
      off();
      await flush();
      expect(events).toHaveLength(2);
      expect(context.api.getPublicInstance!('control')).toBeUndefined();
    });

    it(`${runtime}: subscription follows actual closed Dialog portal identities and owner bindings`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let context!: DemoSetupContext;
      let binding: ReturnType<typeof bindInputShellControl> | undefined;
      const cleanups = new Set<() => void>();
      let current = true;
      const owner = {
        isCurrent: () => current,
        onDispose(fn: () => void) {
          cleanups.add(fn);
          return () => cleanups.delete(fn);
        },
      };
      const pairs: Array<{ shell: unknown; control: unknown; revision: number }> = [];
      const facts: Array<{ disabled: boolean; focusVisible: boolean }> = [];
      const demo: DemoSpec = {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: dialogRoot.name,
          ref: 'dialog',
          props: { defaultOpen: false },
          children: [
            {
              kind: 'proto',
              prototypeId: dialogContent.name,
              ref: 'content',
              props: { enterDuration: 0, leaveDuration: 0 },
              children: [
                {
                  kind: 'proto',
                  prototypeId: inputShell.name,
                  ref: 'shell',
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: inputShellControl.name,
                      ref: 'control',
                      props: { ariaLabel: 'Query' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        setup(ctx) {
          context = ctx;
          const off = ctx.api.subscribePublicInstances!(
            ['shell', 'control'],
            (snapshot, revision) => {
              binding?.dispose();
              binding = undefined;
              pairs.push({ shell: snapshot.shell, control: snapshot.control, revision });
              if (snapshot.shell && snapshot.control) {
                binding = bindInputShellControl(
                  owner,
                  {
                    instance: snapshot.shell,
                    setFacts(value) {
                      facts.push({ ...value });
                      ctx.api.setProps('shell', value);
                    },
                  },
                  snapshot.control
                );
              }
            }
          );
          return () => {
            current = false;
            off();
            binding?.dispose();
            for (const dispose of [...cleanups]) dispose();
          };
        },
      };
      const view = await renderDemo({ host, runtime, demo });
      views.push(view);
      const checkCurrentPair = () => {
        expect(pairs.at(-1)?.shell).toBe(context.api.getPublicInstance!('shell'));
        expect(pairs.at(-1)?.control).toBe(context.api.getPublicInstance!('control'));
        expect(pairs.at(-1)?.control).toBeDefined();
        expect(() =>
          bindInputShellControl(
            owner,
            { instance: context.api.getPublicInstance!('shell')!, setFacts() {} },
            context.api.getPublicInstance!('control')!
          )
        ).toThrow(/Duplicate active binding/);
      };
      await flush();
      checkCurrentPair();
      const readOpen = (ref: string) =>
        (context.api.getExposes(ref)?.open as { get(): boolean }).get();
      expect(readOpen('dialog')).toBe(false);
      expect(readOpen('content')).toBe(false);
      for (const action of ['openDialog', 'close', 'openDialog'] as const) {
        const expectedOpen = action === 'openDialog';
        context.api.call('dialog', action, 'subscription test');
        await vi.waitFor(() => {
          expect(readOpen('dialog')).toBe(expectedOpen);
          expect(readOpen('content')).toBe(expectedOpen);
          checkCurrentPair();
          if (expectedOpen) {
            const content = document.querySelector<HTMLElement>('[data-demo-ref="content"]');
            const control = document.querySelector<HTMLElement>('[data-demo-ref="control"]');
            expect(content?.isConnected).toBe(true);
            expect(control?.isConnected).toBe(true);
            expect(content!.contains(control)).toBe(true);
            expect(host.contains(content)).toBe(false);
            expect(host.contains(control)).toBe(false);
          }
        });
        context.api.setProps('control', { disabled: !expectedOpen });
        await flush();
        expect(facts.at(-1)?.disabled).toBe(!expectedOpen);
      }
      // No invented close-removal event: compare committed raw identities, not a forced-unmount model.
      for (let index = 1; index < pairs.length; index++) {
        expect(pairs[index].revision).toBeGreaterThan(pairs[index - 1].revision);
        expect(
          pairs[index].shell !== pairs[index - 1].shell ||
            pairs[index].control !== pairs[index - 1].control
        ).toBe(true);
      }
      await view.destroy();
      expect(pairs.at(-1)?.shell).toBeUndefined();
      expect(pairs.at(-1)?.control).toBeUndefined();
      expect(cleanups.size).toBe(0);
    });

    it(`${runtime}: subscriptions publish keyed replacement, removal and host generation retirement`, async () => {
      const { context, host } = await mount(runtime);
      const events: Array<{ value: unknown; revision: number }> = [];
      const projected: Array<{ disabled: boolean; focusVisible: boolean }> = [];
      const cleanups = new Set<() => void>();
      const owner = {
        isCurrent: () => true,
        onDispose(fn: () => void) {
          cleanups.add(fn);
          return () => cleanups.delete(fn);
        },
      };
      let binding: ReturnType<typeof bindInputShellControl> | undefined;
      context.api.subscribePublicInstances!(['shell', 'item'], (snapshot, revision) => {
        binding?.dispose();
        binding = undefined;
        events.push({ value: snapshot.item, revision });
        if (snapshot.shell && snapshot.item) {
          binding = bindInputShellControl(
            owner,
            {
              instance: snapshot.shell,
              setFacts(value) {
                projected.push({ ...value });
              },
            },
            snapshot.item
          );
          expect(() =>
            bindInputShellControl(
              owner,
              { instance: snapshot.shell!, setFacts() {} },
              snapshot.item!
            )
          ).toThrow(/Duplicate active binding/);
        }
      });
      await context.api.setChildren!('results', item(inputShellControl.name));
      await flush();
      const first = context.api.getPublicInstance!('item');
      expect(events.at(-1)?.value).toBe(first);
      const count = events.length;
      await context.api.setChildren!('results', item(inputShellControl.name, 'Same'));
      await flush();
      expect(events).toHaveLength(count);
      await context.api.setChildren!('results', item(inputRoot.name));
      await flush();
      expect(events.at(-1)?.value).toBe(context.api.getPublicInstance!('item'));
      expect(events.at(-1)?.value).not.toBe(first);
      context.api.setProps('item', { disabled: true });
      await flush();
      expect(projected.at(-1)?.disabled).toBe(true);
      await context.api.setChildren!('results', []);
      await flush();
      expect(events.at(-1)?.value).toBeUndefined();
      await context.api.setChildren!('results', item(inputRoot.name));
      await flush();
      await mount(runtime, host);
      await flush();
      expect(events.at(-1)?.value).toBeUndefined();
      const retired = vi.fn();
      context.api.subscribePublicInstances!(['item'], retired);
      expect(retired).not.toHaveBeenCalled();
      expect(cleanups.size).toBe(0);
    });

    it(`${runtime}: returns stable real handles, excluding missing and authored box refs`, async () => {
      const { context } = await mount(runtime);
      const instance = context.api.getPublicInstance!('control');
      expect(instance).toBeDefined();
      expect(context.api.getPublicInstance!('control')).toBe(instance);
      expect(instance!.getExposes()?.disabled).toBe(context.api.getExposes('control')?.disabled);
      if (runtime === 'wc') expect(instance).toBe(context.refs.control);
      else expect(instance).not.toBe(context.refs.control);
      expect(context.api.getPublicInstance!('missing')).toBeUndefined();
      // A forged similarly named box property does not create prototype ownership.
      Object.assign(context.refs.box!, { getExposes: () => ({ forged: true }) });
      expect(context.api.getPublicInstance!('box')).toBeUndefined();
    });
    it(`${runtime}: keyed same-type update preserves identity and type/removal replace it`, async () => {
      const { context, view } = await mount(runtime);
      expect(await context.api.setChildren!('results', item())).toBe('committed');
      const first = context.api.getPublicInstance!('item');
      expect(first).toBeDefined();
      expect(await context.api.setChildren!('results', item(button.name, 'Updated'))).toBe(
        'committed'
      );
      expect(context.api.getPublicInstance!('item')).toBe(first);
      expect(await context.api.setChildren!('results', item(inputShellControl.name))).toBe(
        'committed'
      );
      const replacement = context.api.getPublicInstance!('item');
      expect(replacement).toBeDefined();
      expect(replacement).not.toBe(first);
      expect(await context.api.setChildren!('results', [])).toBe('committed');
      expect(context.api.getPublicInstance!('item')).toBeUndefined();
      await view.destroy();
      expect(context.api.getPublicInstance!('control')).toBeUndefined();
    });
    it(`${runtime}: a retired API cannot return a later host generation's instance`, async () => {
      const first = await mount(runtime);
      const instance = first.context.api.getPublicInstance!('control');
      const next = await mount(runtime, first.host);
      expect(first.context.api.getPublicInstance!('control')).toBeUndefined();
      expect(next.context.api.getPublicInstance!('control')).toBeDefined();
      expect(next.context.api.getPublicInstance!('control')).not.toBe(instance);
    });
    it(`${runtime}: real InputShell binding detects duplicate identity and releases it on disposal`, async () => {
      const { context } = await mount(runtime);
      let current = true;
      const cleanups = new Set<() => void>();
      const owner = {
        isCurrent: () => current,
        onDispose(fn: () => void) {
          cleanups.add(fn);
          return () => cleanups.delete(fn);
        },
      };
      const projected = new Map<string, Readonly<{ focusVisible: boolean; disabled: boolean }>>();
      const target = (ref: string) => ({
        instance: context.api.getPublicInstance!(ref)!,
        setFacts(facts: Readonly<{ focusVisible: boolean; disabled: boolean }>) {
          projected.set(ref, { ...facts });
          context.api.setProps(ref, facts);
        },
      });
      const control = context.api.getPublicInstance!('control')!;
      const binding = bindInputShellControl(owner, target('shell'), control);
      expect(() =>
        bindInputShellControl(owner, target('shell'), context.api.getPublicInstance!('control')!)
      ).toThrow(/Duplicate active binding/);
      expect(() =>
        bindInputShellControl(
          owner,
          target('otherShell'),
          context.api.getPublicInstance!('control')!
        )
      ).toThrow(/Duplicate active binding/);
      context.api.setProps('control', { disabled: true });
      await flush();
      expect(projected.get('shell')?.disabled).toBe(true);
      expect((control.getExposes()!.disabled as { get(): boolean }).get()).toBe(true);
      expect(context.api.getPublicInstance!('control')).toBe(control);
      binding.dispose();
      const next = bindInputShellControl(
        owner,
        target('shell'),
        context.api.getPublicInstance!('control')!
      );
      context.api.setProps('control', { disabled: false });
      await flush();
      expect(projected.get('shell')?.disabled).toBe(false);
      context.api.call('control', 'focusSelf', { reason: 'keyboard' });
      await flush();
      expect(projected.get('shell')?.focusVisible).toBe(
        (control.getExposes()!.focusVisible as { get(): boolean }).get()
      );
      current = false;
      for (const cleanup of [...cleanups]) cleanup();
      next.dispose();
      expect(cleanups.size).toBe(0);
    });
    it(`${runtime}: owner disposes the old binding before a real control type replacement and rebinds current facts`, async () => {
      const { context } = await mount(runtime);
      await context.api.setChildren!('results', item(inputShellControl.name));
      const previous = context.api.getPublicInstance!('item')!;
      const cleanups = new Set<() => void>();
      const owner = {
        isCurrent: () => true,
        onDispose(fn: () => void) {
          cleanups.add(fn);
          return () => cleanups.delete(fn);
        },
      };
      const projected: Array<Readonly<{ disabled: boolean; focusVisible: boolean }>> = [];
      const target = {
        instance: context.api.getPublicInstance!('shell')!,
        setFacts(facts: Readonly<{ disabled: boolean; focusVisible: boolean }>) {
          projected.push({ ...facts });
          context.api.setProps('shell', facts);
        },
      };
      const oldBinding = bindInputShellControl(owner, target, previous);
      context.api.setProps('item', { disabled: true });
      await flush();
      expect(projected.at(-1)?.disabled).toBe(true);
      // The composition owns this explicit lifetime boundary; the getter does not retarget bindings.
      oldBinding.dispose();
      expect(cleanups.size).toBe(0);
      const count = projected.length;
      expect(await context.api.setChildren!('results', item(inputRoot.name))).toBe('committed');
      const current = context.api.getPublicInstance!('item')!;
      expect(current).toBeDefined();
      expect(current).not.toBe(previous);
      expect(projected).toHaveLength(count);
      const binding = bindInputShellControl(owner, target, current);
      expect(projected.at(-1)?.disabled).toBe(false);
      expect(() =>
        bindInputShellControl(owner, target, context.api.getPublicInstance!('item')!)
      ).toThrow(/Duplicate active binding/);
      expect(() =>
        bindInputShellControl(
          owner,
          { ...target, instance: context.api.getPublicInstance!('otherShell')! },
          context.api.getPublicInstance!('item')!
        )
      ).toThrow(/Duplicate active binding/);
      context.api.setProps('item', { disabled: true });
      await flush();
      expect(projected.at(-1)?.disabled).toBe(true);
      context.api.setProps('item', { disabled: false });
      context.api.call('item', 'focusSelf', { reason: 'keyboard' });
      await flush();
      expect(projected.at(-1)).toEqual({
        disabled: false,
        focusVisible: (current.getExposes()!.focusVisible as { get(): boolean }).get(),
      });
      for (const cleanup of [...cleanups]) cleanup();
      const stopped = projected.length;
      context.api.setProps('item', { disabled: true });
      await flush();
      expect(projected).toHaveLength(stopped);
      binding.dispose();
      expect(cleanups.size).toBe(0);
    });
  }
});
