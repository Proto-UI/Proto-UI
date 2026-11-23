import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { definePrototype } from '@proto.ui/core';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asTransition } from '../../prototypes/base/src/transition';

export type TransitionTarget = 'react' | 'vue' | 'vue2' | 'wc';
export type TransitionExecution = 'runtime' | 'compiled';
type Variant = 'ordinary' | 'prepared';
type Module = Record<string, any>;
type Generated = Record<TransitionTarget, Record<Variant, Module>>;
type Event = { name: string; at: number };
type Handle = { getExposes(): any };
type Owner = {
  host: HTMLElement;
  handle: Handle;
  events: Event[];
  savedView: Element | null;
  release: (() => void) | null;
  disposed: boolean;
  reenter: boolean;
  retainedEnter: (() => void) | null;
  retainedEnterCalls: number;
  retainedEnterOutcome: { rejected: boolean; rejection: string | null } | null;
  target: TransitionTarget;
  dispose(): void;
};

const variants = Object.fromEntries(
  (['ordinary', 'prepared'] as const).map((variant) => [
    variant,
    definePrototype({
      name: `browser-transition-${variant}`,
      setup() {
        asTransition().configure({
          coldEntryPreparation: variant === 'prepared',
          appear: false,
          enterDuration: 200,
          leaveDuration: 500,
        });
        return (r) => r.el('section', ['Transition view ', r.slot()]);
      },
    }),
  ])
);
const reactAdapter = createReactAdapter(React);
const vueAdapter = createVueAdapter(Vue);
const vue2Adapter = createVue2Adapter({
  extend: Vue2.extend.bind(Vue2) as unknown as Parameters<typeof createVue2Adapter>[0]['extend'],
  nextTick: Vue2.nextTick.bind(Vue2),
  set: Vue2.set.bind(Vue2),
  delete: Vue2.delete.bind(Vue2),
});

async function settled(target: TransitionTarget) {
  await Promise.resolve();
  if (target === 'vue') await Vue.nextTick();
  if (target === 'vue2') await Vue2.nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

function view(owner: Owner) {
  return (owner.host.firstElementChild?.shadowRoot ?? owner.host).querySelector('section');
}

/** Real native framework imports and public exposes; no IR evaluator or mocked host/timer. */
export function createTransitionBrowserFixture(generated: Generated) {
  const owners = new Map<string, Owner>();
  const components = new Map<string, any>();
  let sequence = 0;

  function component(target: TransitionTarget, execution: TransitionExecution, variant: Variant) {
    const key = `${target}/${execution}/${variant}`;
    if (components.has(key)) return components.get(key);
    let value: any;
    if (target === 'wc') {
      value = `transition-browser-${++sequence}`;
      if (execution === 'compiled') generated[target][variant].register(value);
      else AdaptToWebComponent(variants[variant], { registerAs: value });
    } else if (execution === 'compiled') {
      value = generated[target][variant].CompiledComponent ?? generated[target][variant].default;
    } else {
      value = (target === 'react' ? reactAdapter : target === 'vue' ? vueAdapter : vue2Adapter)(
        variants[variant]
      );
    }
    components.set(key, value);
    return value;
  }

  return {
    async mount(
      id: string,
      target: TransitionTarget,
      execution: TransitionExecution,
      variant: Variant = 'ordinary',
      props: Record<string, unknown> = {}
    ) {
      if (owners.has(id)) throw new Error(`Duplicate transition owner ${id}`);
      const host = document.createElement('div');
      host.dataset.transitionOwner = id;
      document.body.append(host);
      const owner: Owner = {
        host,
        handle: null as unknown as Handle,
        events: [],
        savedView: null,
        release: null,
        disposed: false,
        reenter: false,
        retainedEnter: null,
        retainedEnterCalls: 0,
        retainedEnterOutcome: null,
        target,
        dispose() {},
      };
      owners.set(id, owner);
      const Component = component(target, execution, variant);
      const hear = (name: string) => {
        owner.events.push({ name, at: performance.now() });
        if (name === 'afterLeave' && owner.reenter) owner.handle.getExposes().controls.enter();
      };
      const names = ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave'];
      const callbacks = Object.fromEntries(
        names.map((name) => [`on${name[0].toUpperCase()}${name.slice(1)}`, () => hear(name)])
      );
      if (target === 'react') {
        const root = createRoot(host);
        const ref = React.createRef<Handle>();
        flushSync(() =>
          root.render(
            React.createElement(
              Component,
              { ...props, ...callbacks, ref },
              React.createElement('b', null, 'native-child')
            )
          )
        );
        owner.handle = ref.current!;
        owner.dispose = () => flushSync(() => root.unmount());
      } else if (target === 'vue') {
        const ref = Vue.shallowRef<Handle>();
        const app = Vue.createApp({
          render: () =>
            Vue.h(Component, { ...props, ...callbacks, ref }, () => Vue.h('b', 'native-child')),
        });
        app.mount(host);
        await Vue.nextTick();
        owner.handle = ref.value!;
        owner.dispose = () => app.unmount();
      } else if (target === 'vue2') {
        const app = new Vue2({
          render(h) {
            return h(
              Component,
              {
                ref: 'transition',
                props: execution === 'compiled' ? props : {},
                ...(execution === 'runtime' ? { attrs: props } : {}),
                on: Object.fromEntries(names.map((name) => [name, () => hear(name)])),
              },
              [h('b', 'native-child')]
            );
          },
        }).$mount();
        host.append(app.$el);
        await Vue2.nextTick();
        owner.handle = app.$refs.transition as unknown as Handle;
        owner.dispose = () => app.$destroy();
      } else {
        const element = document.createElement(Component) as HTMLElement &
          Handle & {
            setProps(props: Record<string, unknown>): void;
            dispose(): void;
          };
        const child = document.createElement('b');
        child.textContent = 'native-child';
        element.append(child);
        for (const name of names) element.addEventListener(name, () => hear(name));
        if (execution === 'compiled') element.setProps(props);
        else setElementProps(element, props);
        host.append(element);
        owner.handle = element;
        owner.dispose = () => {
          element.remove();
          if (execution === 'compiled') element.dispose();
        };
      }
      await settled(target);
      // Retain the public callable while this owner is alive. A later
      // getExposes() lookup can itself reject after disposal and would never
      // exercise the externally retained reference whose lifetime we test.
      owner.retainedEnter = owner.handle.getExposes().controls.enter;
      if (typeof owner.retainedEnter !== 'function')
        throw new Error(`Owner ${id} did not expose a callable enter control`);
    },
    read(id: string) {
      const owner = owners.get(id)!;
      const exposed = owner.disposed ? null : owner.handle.getExposes();
      const rendered = view(owner);
      return {
        phase: exposed?.transitionState.get() ?? null,
        present: exposed?.isPresent.get() ?? false,
        rendered: Boolean(rendered),
        sameView: Boolean(rendered && rendered === owner.savedView),
        nativeChildren: owner.host.querySelectorAll('b').length,
        connected: owner.host.isConnected,
        disposed: owner.disposed,
        events: [...owner.events],
        retainedControl: {
          captured: typeof owner.retainedEnter === 'function',
          invocations: owner.retainedEnterCalls,
          outcome: owner.retainedEnterOutcome,
        },
        at: performance.now(),
      };
    },
    async operate(id: string, method: 'enter' | 'leave' | 'complete') {
      const owner = owners.get(id)!;
      owner.handle.getExposes().controls[method]();
      await settled(owner.target);
    },
    rememberView(id: string) {
      const owner = owners.get(id)!;
      owner.savedView = view(owner);
    },
    reenterAfterLeave(id: string, enabled: boolean) {
      owners.get(id)!.reenter = enabled;
    },
    capturePreparation(id: string) {
      const owner = owners.get(id)!;
      owner.release = owner.handle.getExposes().controls.capturePreparation();
      return typeof owner.release;
    },
    async releasePreparation(id: string) {
      const owner = owners.get(id)!;
      owner.release?.();
      await settled(owner.target);
    },
    async dispose(id: string) {
      const owner = owners.get(id)!;
      if (owner.disposed) return;
      owner.dispose();
      owner.host.remove();
      await settled(owner.target);
      owner.disposed = true;
    },
    async retiredEnter(id: string) {
      const owner = owners.get(id)!;
      if (!owner.disposed || !owner.retainedEnter)
        throw new Error('Retired-control probe requires a previously captured live control');
      let rejected = false;
      let rejection: string | null = null;
      owner.retainedEnterCalls += 1;
      try {
        Reflect.apply(owner.retainedEnter, undefined, []);
      } catch (error) {
        rejected = true;
        rejection = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }
      owner.retainedEnterOutcome = { rejected, rejection };
      await settled(owner.target);
      return {
        capturedWhileAlive: true,
        invocation: owner.retainedEnterCalls,
        rejected,
        rejection,
        connected: owner.host.isConnected,
        rendered: Boolean(view(owner)),
      };
    },
  };
}
