import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExposedStateHandle } from '@proto.ui/core';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonPressedFill,
  bootstrapButtonPressed,
} from '../../../../../packages/prototypes/bootstrap-2-3-2/src/button/paint';
import { createFamilyDialogDemo } from '../../content/docs/overlay-control-recipes-r94.shared';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import {
  collectPrototypeIds,
  type DemoPublicInstance,
  type DemoRuntimeApi,
  type DemoSetupContext,
} from './demo-types';
import type { RuntimeId } from './runtimes/ids';

// Only CDN loaders are replaced. The shared recipe, prototypes, adapters and
// installed frameworks run unchanged. HappyDOM input/focus is not native Tab,
// hit testing, assistive-technology or pixel evidence.
vi.mock('./runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const current = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

const cleanups: Array<() => void | Promise<void>> = [];
let consoleErrors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleErrors = vi.spyOn(console, 'error');
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
  expect(
    consoleErrors.mock.calls.filter(([message]) =>
      String(message).includes('flushSync was called from inside a lifecycle method')
    )
  ).toHaveLength(0);
  vi.restoreAllMocks();
});

function value<T>(api: DemoRuntimeApi, ref: string, state: string): T {
  const handle = api.getExposes(ref)?.[state] as { get(): T } | undefined;
  if (!handle) throw new Error(`Missing public ${ref}.${state}`);
  return handle.get();
}

async function mount(
  runtime: RuntimeId,
  options: { host?: HTMLElement; controlled?: boolean } = {}
) {
  const demo = createFamilyDialogDemo('bootstrap-2-3-2');
  const ids = new Set<string>();
  collectPrototypeIds(demo.root, ids);
  await loadPrototypes([...ids]);
  const host = options.host ?? document.createElement('div');
  if (!host.isConnected) document.body.append(host);
  let context!: DemoSetupContext;
  const requests = vi.fn();
  const writes = vi.fn();
  let subscriptions: Array<{
    key: string;
    callback: Parameters<ExposedStateHandle<boolean>['subscribe']>[0];
    off: ReturnType<typeof vi.fn>;
  }> = [];
  let releaseSetup: (() => void) | undefined;
  const view = await renderDemo({
    runtime,
    host,
    demo: {
      ...demo,
      setup(ctx) {
        // Observe the subscriptions at the instance reader used by the recipe.
        // Each read refreshes the adapter's scoped expose handles.
        const observedInstances = new WeakMap<DemoPublicInstance, DemoPublicInstance>();
        const observeClose = (close: DemoPublicInstance | undefined) => {
          if (!close) return;
          let observed = observedInstances.get(close);
          if (!observed) {
            observed = {
              getExposes() {
                const exposes = { ...close.getExposes() };
                // Opening can replace the original committed Close view.
                // Track the four registrations of each observed binding.
                const binding: typeof subscriptions = [];
                subscriptions = binding;
                for (const key of ['disabled', 'hovered', 'pressed', 'focusVisible']) {
                  const state = exposes[key] as ExposedStateHandle<boolean>;
                  exposes[key] = {
                    ...state,
                    subscribe(callback: Parameters<ExposedStateHandle<boolean>['subscribe']>[0]) {
                      const off = vi.fn(state.subscribe(callback));
                      binding.push({ key, callback, off });
                      return off;
                    },
                  };
                }
                return exposes;
              },
            };
            observedInstances.set(close, observed);
          }
          return observed;
        };
        const api: DemoRuntimeApi = {
          ...ctx.api,
          getPublicInstance(ref) {
            const instance = ctx.api.getPublicInstance!(ref);
            return ref === 'close' ? observeClose(instance) : instance;
          },
          subscribePublicInstances(refs, listener) {
            return ctx.api.subscribePublicInstances!(refs, (snapshot, revision) =>
              listener({ ...snapshot, close: observeClose(snapshot.close) }, revision)
            );
          },
          setProps(ref, props) {
            writes(ref, props);
            ctx.api.setProps(ref, props);
          },
        };
        context = { ...ctx, api };
        if (options.controlled) api.setProps('root', { open: true, onOpenChange: requests });
        const release = demo.setup?.(context);
        if (typeof release === 'function') releaseSetup = release;
        return release;
      },
    },
  });
  cleanups.push(() => view.destroy());
  await vi.waitFor(() => expect(context.api.getExposes('root')?.open).toBeDefined());
  context.api.call('root', 'openDialog');
  await vi.waitFor(() => {
    expect(value(context.api, 'root', 'open')).toBe(true);
    expect(value(context.api, 'content', 'transitionState')).toBe('entered');
  });
  requests.mockClear();
  return {
    ...context,
    view,
    requests,
    writes,
    subscriptions,
    releaseSetup: () => releaseSetup?.(),
  };
}

const pointer = (target: HTMLElement, type: string) =>
  target.dispatchEvent(
    new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  );
function keyboard(target: HTMLElement, key: string) {
  const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(down);
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  return down;
}
// Actual renderer feedback-token projection; CSS pixels remain a native evidence boundary.
const hasToken = (element: HTMLElement, token: string) =>
  (element.getAttribute('data-pui-style') ?? '').split(/\s+/).includes(token);
const frame = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('Bootstrap Dialog recipe keeps Close as its only command owner', () => {
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    '%s has one semantic button and one focus owner for the footer action',
    async (runtime) => {
      const { refs, api } = await mount(runtime);
      const close = refs.close!;
      const subtree = [close, ...close.querySelectorAll<HTMLElement>('*')];
      const owners = subtree.filter((element) => element.matches('button, [role="button"]'));
      const focusable = [close, ...close.querySelectorAll<HTMLElement>('*')].filter(
        (element) => element.tabIndex >= 0
      );
      expect(close.textContent).toBe('Close project details');
      const ownerName = (element: HTMLElement) =>
        element === close ? 'close' : `${element.tagName}:${element.dataset.demoRef ?? 'child'}`;
      // Continuous Trigger groups can move physical role/focus to an inner
      // Button; two logical owners need not produce two DOM tab stops. Assert
      // that Close itself remains the physical owner and the content is passive.
      expect.soft(close.getAttribute('role')).toBe('button');
      expect.soft(owners.map(ownerName)).toEqual(['close']);
      expect.soft(focusable.map(ownerName)).toEqual(['close']);
      expect(close.style.display).toBe('inline-flex');
      expect(api.getExposes('closeAppearance')).toEqual({});
      expect(api.getExposes('closeLabel')).toEqual({});
      api.call('close', 'focusSelf', { reason: 'keyboard' });
      await vi.waitFor(() => expect(value(api, 'close', 'focused')).toBe(true));
      expect.soft(document.activeElement === close).toBe(true);
    }
  );

  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    '%s projects passive appearance from real Close facts and suppresses disabled feedback',
    async (runtime) => {
      const { refs, api, requests } = await mount(runtime, { controlled: true });
      const close = refs.close!;
      const surface = refs.closeAppearance!;
      const label = refs.closeLabel!;
      expect(surface.getAttribute('role')).toBeNull();
      expect(surface.hasAttribute('tabindex')).toBe(false);
      expect(label.getAttribute('role')).toBeNull();
      expect(label.hasAttribute('tabindex')).toBe(false);
      expect(hasToken(label, 'text-[14px]')).toBe(true);
      expect(hasToken(surface, 'px-[12px]')).toBe(true);
      expect(hasToken(surface, 'py-[4px]')).toBe(true);
      expect(surface.style.pointerEvents).toBe('none');

      close.blur();
      await vi.waitFor(() => expect(hasToken(surface, bootstrapButtonRestFill.default)).toBe(true));
      pointer(close, 'pointerenter');
      await vi.waitFor(() => {
        expect(value(api, 'close', 'hovered')).toBe(true);
        expect(hasToken(surface, bootstrapButtonInteractiveFill.default)).toBe(true);
      });
      pointer(close, 'pointerdown');
      await vi.waitFor(() => {
        expect(value(api, 'close', 'pressed')).toBe(true);
        expect(hasToken(surface, bootstrapButtonPressedFill.default)).toBe(true);
        expect(hasToken(surface, bootstrapButtonPressed)).toBe(true);
      });
      pointer(close, 'pointercancel');
      await vi.waitFor(() => {
        expect(value(api, 'close', 'pressed')).toBe(false);
        expect(value(api, 'close', 'hovered')).toBe(false);
        expect(hasToken(surface, bootstrapButtonRestFill.default)).toBe(true);
      });
      api.call('close', 'focusSelf', { reason: 'keyboard' });
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(close);
        expect(value(api, 'close', 'focusVisible')).toBe(true);
        expect(hasToken(surface, 'ring-2')).toBe(true);
      });

      for (const disabledOwner of ['close', 'root']) {
        api.setProps(disabledOwner, { disabled: true });
        await vi.waitFor(() => {
          expect(value(api, 'close', 'disabled')).toBe(true);
          expect(close.getAttribute('aria-disabled')).toBe('true');
          expect(hasToken(surface, 'ring-2')).toBe(false);
          expect(hasToken(surface, bootstrapButtonRestFill.default)).toBe(true);
        });
        close.blur();
        api.call('close', 'focusSelf', { reason: 'keyboard' });
        pointer(close, 'pointerenter');
        pointer(close, 'pointerdown');
        pointer(close, 'pointerup');
        close.click();
        keyboard(close, 'Enter');
        keyboard(close, ' ');
        await frame();
        expect(document.activeElement).not.toBe(close);
        expect(value(api, 'close', 'hovered')).toBe(false);
        expect(value(api, 'close', 'pressed')).toBe(false);
        expect(value(api, 'root', 'open')).toBe(true);
        expect(requests).not.toHaveBeenCalled();
        api.setProps(disabledOwner, { disabled: false });
        await vi.waitFor(() => expect(value(api, 'close', 'disabled')).toBe(false));
        api.call('close', 'focusSelf', { reason: 'keyboard' });
        await vi.waitFor(() => {
          expect(value(api, 'close', 'focusVisible')).toBe(true);
          expect(hasToken(surface, 'ring-2')).toBe(true);
        });
      }
    }
  );

  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    '%s keeps pointer and keyboard activation with Close across refusal, acceptance and reopen',
    async (runtime) => {
      const { refs, api, requests } = await mount(runtime, { controlled: true });
      const close = refs.close!;
      pointer(close, 'pointerdown');
      pointer(close, 'pointerup');
      close.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await vi.waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
      expect(requests.mock.calls[0]?.[0]).toMatchObject({
        open: false,
        reason: 'close.press',
        focusReason: 'pointer',
      });
      expect(value(api, 'root', 'open')).toBe(true);
      for (const key of ['Enter', ' ']) {
        api.call('close', 'focusSelf', { reason: 'keyboard' });
        if (runtime === 'vue') {
          // Public call requests a Vue update; native input arrives after its commit.
          const { loadVue } = await import('./runtimes/vue-runtime');
          await (await loadVue()).nextTick();
        }
        await vi.waitFor(() => {
          expect(document.activeElement).toBe(close);
          expect(value(api, 'close', 'focused')).toBe(true);
        });
        const before = requests.mock.calls.length;
        const down = keyboard(close, key);
        // A browser may follow a keyboard activation with this zero-detail click.
        close.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
        await vi.waitFor(() => expect(requests).toHaveBeenCalledTimes(before + 1));
        expect(requests.mock.calls.at(-1)?.[0]).toMatchObject({
          open: false,
          reason: 'close.press',
          focusReason: 'keyboard',
        });
        if (key === ' ') expect(down.defaultPrevented).toBe(true);
        expect(value(api, 'root', 'open')).toBe(true);
        await frame();
      }
      api.setProps('root', { open: false });
      await vi.waitFor(() => {
        expect(value(api, 'root', 'open')).toBe(false);
        expect(value(api, 'content', 'transitionState')).toBe('closed');
      });
      api.setProps('root', { open: true });
      await vi.waitFor(() => expect(value(api, 'content', 'transitionState')).toBe('entered'));
      api.removeProps!('root', ['open']);
      await frame();
      // Retained framework views may replace native carriers on reopen.
      const reopenedClose = refs.close!;
      expect(reopenedClose.isConnected).toBe(true);
      const before = requests.mock.calls.length;
      pointer(reopenedClose, 'pointerdown');
      pointer(reopenedClose, 'pointerup');
      reopenedClose.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await vi.waitFor(() => {
        expect(requests).toHaveBeenCalledTimes(before + 1);
        expect(value(api, 'root', 'open')).toBe(false);
      });
    }
  );

  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    '%s retires subscriptions and ignores late state callbacks after replacement',
    async (runtime) => {
      const old = await mount(runtime);
      expect(old.subscriptions.map(({ key }) => key).sort()).toEqual([
        'disabled',
        'focusVisible',
        'hovered',
        'pressed',
      ]);
      pointer(old.refs.close!, 'pointerenter');
      await vi.waitFor(() =>
        expect(hasToken(old.refs.closeAppearance!, bootstrapButtonInteractiveFill.default)).toBe(
          true
        )
      );
      const next = await mount(runtime, { host: old.host });
      for (const { off } of old.subscriptions) expect(off).toHaveBeenCalledTimes(1);
      old.writes.mockClear();
      next.writes.mockClear();
      const nextPaint = next.refs.closeAppearance!.getAttribute('data-pui-style');
      // Artificial late delivery of the actual callbacks that were registered
      // on the old real state handles. No state or renderer is replaced.
      for (const { callback } of old.subscriptions) {
        callback({ type: 'next', prev: false, next: true });
        callback({ type: 'disconnect', reason: 'unmount' });
      }
      old.releaseSetup();
      await old.view.destroy();
      await frame();
      expect(old.writes).not.toHaveBeenCalled();
      expect(next.writes).not.toHaveBeenCalled();
      expect(next.refs.closeAppearance!.getAttribute('data-pui-style')).toBe(nextPaint);
      pointer(next.refs.close!, 'pointerenter');
      await vi.waitFor(() =>
        expect(hasToken(next.refs.closeAppearance!, bootstrapButtonInteractiveFill.default)).toBe(
          true
        )
      );
      pointer(next.refs.close!, 'pointerdown');
      next.writes.mockClear();
      // Retire before the queued appearance projection can run.
      await next.view.destroy();
      await frame();
      expect(next.writes).not.toHaveBeenCalled();
      for (const { off } of next.subscriptions) expect(off).toHaveBeenCalledTimes(1);
    }
  );
});
