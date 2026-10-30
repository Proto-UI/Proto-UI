import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { definePrototype } from '@proto.ui/core';
import * as drawer from '@proto.ui/prototypes-shadcn/drawer';
import drawerDemo from '../../content/docs/demo-shadcn-drawer.demo';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import type { DemoRenderResult, DemoRuntimeApi, DemoSetupContext } from './demo-types';

const prototypeId = 'test-demo-expose-events';
registerPrototype(
  prototypeId,
  definePrototype({
    name: prototypeId,
    setup(def) {
      let current: any;
      def.expose.event('valueChange');
      def.expose.event('click');
      def.expose.event('uRLChange');
      def.lifecycle.onCreated((run) => {
        current = run;
      });
      def.expose.method('send', (key: string, payload: unknown) =>
        current.expose.emit(key, payload)
      );
      def.expose.method('raw', () => current.props.getRaw());
    },
  })
);

const views: DemoRenderResult[] = [];
afterEach(async () => {
  for (const view of views.splice(0)) await view.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(
  setup?: (context: DemoSetupContext) => void | (() => void),
  host: HTMLElement = document.createElement('div')
) {
  if (!host.isConnected) document.body.append(host);
  let context!: DemoSetupContext;
  let element!: HTMLElement;
  const view = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      type: 'demo',
      root: { kind: 'proto', prototypeId, ref: 'subject' },
      setup(next) {
        context = next;
        element = next.refs.subject!;
        return setup?.(next);
      },
    },
  });
  views.push(view);
  return { ...context, view, element };
}

const send = (api: DemoRuntimeApi, payload: unknown, key = 'valueChange') =>
  api.call('subject', 'send', key, payload);
const dispatch = (el: HTMLElement, payload: unknown, type = 'valueChange') =>
  el.dispatchEvent(new CustomEvent(type, { detail: payload, bubbles: true, composed: true }));

describe('WC DemoRuntimeApi callback projection', () => {
  it('maps onX to payload callbacks while preserving the original raw props snapshot', async () => {
    const callback = vi.fn();
    const ordinary = vi.fn();
    const { api, element } = await mount(({ api }) =>
      api.setProps('subject', {
        onValueChange: callback,
        onwork: ordinary,
        compute: ordinary,
        label: 'retained',
      })
    );
    const payload = { value: 'first' };
    send(api, payload);
    expect(callback.mock.calls).toEqual([[payload]]);
    expect(callback.mock.calls[0]![0]).toBe(payload);
    expect(api.call('subject', 'raw')).toMatchObject({
      onValueChange: callback,
      onwork: ordinary,
      compute: ordinary,
      label: 'retained',
    });
    dispatch(element, payload, 'work');
    dispatch(element, payload, 'compute');
    expect(ordinary).not.toHaveBeenCalled();
  });

  it('replaces callbacks once, retains omitted keys, and removes nonfunction patches', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { api, element } = await mount(({ api }) =>
      api.setProps('subject', { onValueChange: first })
    );
    const add = vi.spyOn(element, 'addEventListener');
    const remove = vi.spyOn(element, 'removeEventListener');
    send(api, 1);
    api.setProps('subject', { onValueChange: second });
    api.setProps('subject', { unrelated: true });
    api.setSurfaceStyle?.('subject', { color: 'red' });
    send(api, 2);
    expect(first.mock.calls).toEqual([[1]]);
    expect(second.mock.calls).toEqual([[2]]);
    for (const clear of [undefined, null, false]) {
      api.setProps('subject', { onValueChange: clear });
      send(api, 'ignored');
    }
    expect(second).toHaveBeenCalledTimes(1);
    api.setProps('subject', { onValueChange: second });
    send(api, 3);
    expect(second).toHaveBeenCalledTimes(2);
    // Replacing a function only swaps the current callback; no duplicate listeners.
    expect(add.mock.calls.filter(([key]) => key === 'valueChange')).toHaveLength(1);
    expect(remove.mock.calls.filter(([key]) => key === 'valueChange')).toHaveLength(1);
  });

  it('ignores native input with the same name and preserves the established first-letter case rule', async () => {
    const click = vi.fn();
    const acronym = vi.fn();
    const { api, element } = await mount(({ api }) =>
      api.setProps('subject', { onClick: click, onURLChange: acronym })
    );
    element.click();
    expect(click).not.toHaveBeenCalled();
    send(api, { source: 'outward' }, 'click');
    expect(click.mock.calls).toEqual([[{ source: 'outward' }]]);
    send(api, 'case', 'uRLChange');
    expect(acronym.mock.calls).toEqual([['case']]);
    dispatch(element, 'wrong case', 'URLChange');
    expect(acronym).toHaveBeenCalledTimes(1);
  });

  it('ignores nested light/shadow composed signals even when a shadow target retargets to the owner', async () => {
    const callback = vi.fn();
    const { api, element } = await mount(({ api }) =>
      api.setProps('subject', { onValueChange: callback })
    );
    const light = document.createElement('span');
    element.append(light);
    const shadow = document.createElement('span');
    (element.shadowRoot ?? element.attachShadow({ mode: 'open' })).append(shadow);
    dispatch(light, 'light');
    dispatch(shadow, 'shadow');
    expect(callback).not.toHaveBeenCalled();
    send(api, 'owner');
    expect(callback.mock.calls).toEqual([['owner']]);
  });

  it('uses the CustomEvent brand instead of the current global constructor and excludes MouseEvents', async () => {
    const callback = vi.fn();
    const { element } = await mount(({ api }) =>
      api.setProps('subject', { onValueChange: callback })
    );
    const foreign = new Window();
    // Happy DOM windows share event constructors. Replace the ambient constructor
    // to discriminate a global-instanceof check without claiming a real iframe run.
    const OriginalCustomEvent: new (
      type: string,
      eventInitDict?: CustomEventInit<unknown>
    ) => CustomEvent<unknown> = CustomEvent;
    vi.stubGlobal(
      'CustomEvent',
      class OtherCustomEvent extends OriginalCustomEvent {
        // Happy DOM lacks the native getter's WebIDL receiver validation.
        get detail() {
          if (!(this instanceof OriginalCustomEvent)) throw new TypeError('Illegal invocation');
          return super.detail;
        }
      }
    );
    const payload = { realm: 'other' };
    const event = new foreign.CustomEvent('valueChange', { detail: payload });
    // Model the browser's standard brand, absent in Happy DOM 15.
    Object.defineProperty(event, Symbol.toStringTag, { value: 'CustomEvent' });
    expect(event instanceof CustomEvent).toBe(false);
    element.dispatchEvent(event as unknown as Event);
    element.dispatchEvent(new foreign.MouseEvent('valueChange', { detail: 1 }) as unknown as Event);
    const forged = new foreign.MouseEvent('valueChange', { detail: 2 });
    Object.defineProperty(forged, Symbol.toStringTag, { value: 'CustomEvent' });
    element.dispatchEvent(forged as unknown as Event);
    expect(callback.mock.calls).toEqual([[payload]]);
    await foreign.happyDOM.close();
  });

  it('keeps one listener across same-element synchronous detach/remount and callback self-replacement', async () => {
    const second = vi.fn();
    let api!: DemoRuntimeApi;
    const first = vi.fn(() => api.setProps('subject', { onValueChange: second }));
    const mounted = await mount(({ api: next }) => {
      api = next;
      api.setProps('subject', { onValueChange: first });
    });
    mounted.element.remove();
    mounted.host.append(mounted.element);
    send(api, 1);
    send(api, 2);
    expect(first.mock.calls).toEqual([[1]]);
    expect(second.mock.calls).toEqual([[2]]);
  });

  it('retires listeners and stale API before throwing teardown, and starts a fresh same-ref owner', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const failure = new Error('setup cleanup');
    const mounted = await mount(({ api, refs }) => {
      api.setProps('subject', { onValueChange: first });
      return () => {
        dispatch(refs.subject!, 'teardown');
        api.setProps('subject', { onValueChange: first });
        throw failure;
      };
    });
    const remove = vi.spyOn(mounted.element, 'removeEventListener');
    expect(() => mounted.view.destroy()).toThrow(failure);
    expect(mounted.element.isConnected).toBe(false);
    dispatch(mounted.element, 'old');
    mounted.api.setProps('subject', { onValueChange: first });
    expect(first).not.toHaveBeenCalled();
    expect(remove.mock.calls.filter(([key]) => key === 'valueChange')).toHaveLength(1);
    const next = await mount(
      ({ api }) => api.setProps('subject', { onValueChange: second }),
      mounted.host
    );
    send(next.api, 'new');
    mounted.view.destroy();
    send(next.api, 'still new');
    expect(second.mock.calls).toEqual([['new'], ['still new']]);
  });

  it('registers cleanup before setup can fail after moving an owner out of the host', async () => {
    const callback = vi.fn();
    const failure = new Error('setup failed');
    let retained!: HTMLElement;
    let stale!: DemoRuntimeApi;
    await expect(
      mount(({ api, refs }) => {
        retained = refs.subject!;
        stale = api;
        api.setProps('subject', { onValueChange: callback });
        document.body.append(retained);
        throw failure;
      })
    ).rejects.toThrow(failure);
    expect(retained.isConnected).toBe(false);
    dispatch(retained, 'old');
    stale.setProps('subject', { onValueChange: callback });
    expect(callback).not.toHaveBeenCalled();
  });

  it('cleans a setup that synchronously reenters the same host without disturbing its replacement', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const cleanup = vi.fn();
    let replacement!: ReturnType<typeof mount>;
    const old = await mount(({ api, host }) => {
      api.setProps('subject', { onValueChange: first });
      replacement = mount(({ api }) => api.setProps('subject', { onValueChange: second }), host);
      return cleanup;
    });
    const current = await replacement;
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(old.refs.subject).toBeUndefined();
    expect(old.element.isConnected).toBe(false);
    old.api.setProps('subject', { onValueChange: first });
    dispatch(old.element, 'retired');
    send(current.api, 'current');
    old.view.destroy();
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls).toEqual([['current']]);
    expect(current.element.isConnected).toBe(true);
  });

  it('revokes delivery immediately when the caller invalidates its current-generation predicate', async () => {
    let current = true;
    let api!: DemoRuntimeApi;
    let element!: HTMLElement;
    const callback = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    const view = await renderDemo({
      runtime: 'wc',
      host,
      isCurrent: () => current,
      demo: {
        type: 'demo',
        root: { kind: 'proto', prototypeId, ref: 'subject' },
        setup(context) {
          api = context.api;
          element = context.refs.subject!;
          api.setProps('subject', { onValueChange: callback });
        },
      },
    });
    views.push(view);
    send(api, 1);
    current = false;
    dispatch(element, 2);
    api.setProps('subject', { onValueChange: callback });
    expect(callback.mock.calls).toEqual([[1]]);
  });
});

it('preserves a falsy setup failure while completing every remaining cleanup step', async () => {
  let retained!: HTMLElement;
  const removed: string[] = [];
  let thrown = false;
  let actual: unknown;
  try {
    await mount(({ api, refs }) => {
      retained = refs.subject!;
      api.setProps('subject', { onValueChange: () => {}, onClick: () => {} });
      const remove = retained.removeEventListener.bind(retained);
      vi.spyOn(retained, 'removeEventListener').mockImplementation((...args) => {
        removed.push(args[0]);
        remove(...args);
        if (args[0] === 'valueChange') throw new Error('secondary cleanup failure');
      });
      document.body.append(retained);
      throw false;
    });
  } catch (error) {
    thrown = true;
    actual = error;
  }
  expect(thrown).toBe(true);
  expect(actual).toBe(false);
  expect(removed).toContain('valueChange');
  expect(removed).toContain('click');
  expect(retained.isConnected).toBe(false);
});

it('does not install callbacks or props after a caller getter replaces the host', async () => {
  const stale = vi.fn();
  const current = vi.fn();
  const old = await mount();
  let replacement!: ReturnType<typeof mount>;
  const add = vi.spyOn(old.element, 'addEventListener');
  old.api.setProps('subject', {
    get onValueChange() {
      replacement = mount(
        ({ api }) => api.setProps('subject', { onValueChange: current }),
        old.host
      );
      return stale;
    },
  });
  const next = await replacement;
  expect(add.mock.calls.filter(([key]) => key === 'valueChange')).toHaveLength(0);
  dispatch(old.element, 'stale');
  send(next.api, 'current');
  expect(stale).not.toHaveBeenCalled();
  expect(current.mock.calls).toEqual([['current']]);
});

it('removes an acquisition that finishes after synchronous listener-registration reentry', async () => {
  const old = await mount();
  const stale = vi.fn();
  const current = vi.fn();
  let replacement!: ReturnType<typeof mount>;
  const add = old.element.addEventListener.bind(old.element);
  const remove = vi.spyOn(old.element, 'removeEventListener');
  vi.spyOn(old.element, 'addEventListener').mockImplementationOnce((...args) => {
    replacement = mount(({ api }) => api.setProps('subject', { onValueChange: current }), old.host);
    add(...args);
  });
  old.api.setProps('subject', { onValueChange: stale });
  const next = await replacement;
  expect(remove.mock.calls.filter(([key]) => key === 'valueChange')).toHaveLength(2);
  dispatch(old.element, 'stale');
  send(next.api, 'current');
  expect(stale).not.toHaveBeenCalled();
  expect(current.mock.calls).toEqual([['current']]);
});

it('stops old tree construction when a connected prototype replaces the host', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  let replacement!: ReturnType<typeof mount>;
  const laterSetup = vi.fn();
  const current = vi.fn();
  registerPrototype(
    'test-demo-reentry-first',
    definePrototype({
      name: 'test-demo-reentry-first',
      setup(def) {
        def.lifecycle.onCreated(() => {
          replacement = mount(
            ({ api }) => api.setProps('subject', { onValueChange: current }),
            host
          );
        });
      },
    })
  );
  registerPrototype(
    'test-demo-reentry-later',
    definePrototype({
      name: 'test-demo-reentry-later',
      setup: laterSetup,
    })
  );
  const setup = vi.fn();
  const old = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        children: [
          { kind: 'proto', prototypeId: 'test-demo-reentry-first' },
          { kind: 'proto', prototypeId: 'test-demo-reentry-later' },
        ],
      },
      setup,
    },
  });
  views.push(old);
  const next = await replacement;
  expect(laterSetup).not.toHaveBeenCalled();
  expect(setup).not.toHaveBeenCalled();
  expect(host.children).toHaveLength(1);
  send(next.api, 'current');
  expect(current.mock.calls).toEqual([['current']]);
});

it('the actual public Drawer demo updates status from the real Root outward signal across open/close', async () => {
  vi.stubGlobal('CSS', { supports: () => true });
  for (const value of Object.values(drawer)) {
    if (value && typeof value === 'object' && 'name' in value)
      registerPrototype(value.name, value as any);
  }
  const host = document.createElement('div');
  document.body.append(host);
  const view = await renderDemo({ host, runtime: 'wc', demo: drawerDemo });
  views.push(view);
  const root = host.querySelector('wc-shadcn-drawer-root')!;
  const events: unknown[] = [];
  root.addEventListener('openChange', (event) => events.push((event as CustomEvent).detail));
  const trigger = host.querySelector<HTMLElement>('wc-shadcn-drawer-trigger')!;
  trigger.click();
  for (let i = 0; i < 50; i++) await Promise.resolve();
  expect(events).toMatchObject([{ open: true }]);
  expect(
    (root as HTMLElement & { getExposes(): { open: { get(): boolean } } }).getExposes().open.get()
  ).toBe(true);
  expect(host.querySelector('[data-demo-ref=status]')?.textContent).toMatch(/^Opened:/);
  document.querySelector<HTMLElement>('wc-shadcn-drawer-close')!.click();
  for (let i = 0; i < 50; i++) await Promise.resolve();
  expect(events).toMatchObject([{ open: true }, { open: false }]);
  expect(
    (root as HTMLElement & { getExposes(): { open: { get(): boolean } } }).getExposes().open.get()
  ).toBe(false);
  expect(host.querySelector('[data-demo-ref=status]')?.textContent).toMatch(/^Closed:/);
});
