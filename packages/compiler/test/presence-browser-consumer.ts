import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import prototype from './fixtures/presence-presentation-owner.proto';

type Target = 'react' | 'vue' | 'vue2' | 'wc';
type Execution = 'runtime' | 'compiled';
type Props = { open: boolean; side: 'left' | 'right' };
type Handle = {
  getExposes(): { transitionState: { get(): string }; isPresent: { get(): boolean } };
};
const adapters = {
  react: createReactAdapter(React),
  vue: createVueAdapter(Vue),
  vue2: createVue2Adapter({
    extend: Vue2.extend.bind(Vue2) as any,
    nextTick: Vue2.nextTick.bind(Vue2),
    set: Vue2.set.bind(Vue2),
    delete: Vue2.delete.bind(Vue2),
  }),
};
async function flush(target: Target) {
  await Promise.resolve();
  if (target === 'vue') await Vue.nextTick();
  if (target === 'vue2') await Vue2.nextTick();
  await Promise.resolve();
}

/** Native framework props and the public owner expose surface drive the authored source. */
export function createPresenceBrowserFixture(generated: Record<Target, any>) {
  let sequence = 0;
  const components = new Map<string, any>();
  let active: {
    host: HTMLElement;
    handle: Handle;
    props: Props;
    update(next: Props): Promise<void>;
    close(): Promise<void>;
  } | null = null;
  let tracing = false,
    raf: number | null = null;
  let frames: ReturnType<typeof read>[] = [];
  function read() {
    if (!active)
      return {
        phase: 'disposed',
        present: false,
        time: performance.now(),
        opacity: null,
        translate: null,
        x: null,
        width: null,
        inlineOpacity: null,
        inlineTranslate: null,
        text: '',
      };
    const exposed = active.handle.getExposes();
    const root = active.host.firstElementChild as HTMLElement | null;
    const present = exposed.isPresent.get(),
      css = root ? getComputedStyle(root) : null,
      box = root?.getBoundingClientRect();
    return {
      phase: exposed.transitionState.get(),
      present,
      time: performance.now(),
      opacity: present && css ? Number(css.opacity) : null,
      translate:
        present && css ? (css.translate === 'none' ? 0 : Number.parseFloat(css.translate)) : null,
      x: present && box ? box.x : null,
      width: present && box ? box.width : null,
      inlineOpacity: root?.style.opacity ?? null,
      inlineTranslate: root?.style.translate ?? null,
      text: active.host.textContent ?? '',
    };
  }
  function stop() {
    tracing = false;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }
  function sample() {
    if (!tracing) return;
    frames.push(read());
    raf = requestAnimationFrame(sample);
  }
  async function close() {
    stop();
    if (active) {
      const previous = active;
      active = null;
      await previous.close();
      previous.host.remove();
    }
    await Promise.resolve();
  }
  function component(target: Target, execution: Execution) {
    const key = target + '/' + execution;
    if (components.has(key)) return components.get(key);
    let value: any;
    if (target === 'wc') {
      value = `presence-${execution}-${++sequence}`;
      if (execution === 'compiled') generated.wc.register(value);
      else AdaptToWebComponent(prototype as any, { registerAs: value });
    } else
      value =
        execution === 'compiled'
          ? target === 'react'
            ? generated.react.CompiledComponent
            : generated[target].default
          : adapters[target](prototype as any);
    components.set(key, value);
    return value;
  }
  return {
    async mount(target: Target, execution: Execution) {
      await close();
      frames = [];
      const host = document.createElement('div');
      host.id = 'consumer';
      document.body.append(host);
      const Component = component(target, execution);
      let props: Props = { open: false, side: 'left' };
      let handle: Handle, update: (next: Props) => Promise<void>, unmount: () => void;
      if (target === 'react') {
        const app = createRoot(host),
          ref = React.createRef<Handle>();
        update = async (next) => {
          props = next;
          flushSync(() =>
            app.render(React.createElement(Component, { ...props, ref }, 'ordinary slot'))
          );
          await flush(target);
        };
        unmount = () => flushSync(() => app.unmount());
        await update(props);
        handle = ref.current!;
      } else if (target === 'vue') {
        const input = Vue.shallowRef(props),
          ref = Vue.ref<Handle>();
        const app = Vue.createApp({
          render: () =>
            Vue.h(Component, { ...input.value, ref }, { default: () => 'ordinary slot' }),
        });
        app.mount(host);
        await flush(target);
        handle = ref.value!;
        update = async (next) => {
          input.value = next;
          await flush(target);
        };
        unmount = () => app.unmount();
      } else if (target === 'vue2') {
        const app = new Vue2({
          render(h) {
            return h(Component, { ref: 'owner', props, attrs: props }, ['ordinary slot']);
          },
        });
        app.$mount();
        host.append(app.$el);
        await flush(target);
        handle = app.$refs.owner as unknown as Handle;
        update = async (next) => {
          props = next;
          app.$forceUpdate();
          await flush(target);
        };
        unmount = () => app.$destroy();
      } else {
        const element = document.createElement(Component) as HTMLElement &
          Handle & { setProps(input: Props): void; dispose(): void };
        element.textContent = 'ordinary slot';
        update = async (next) => {
          if (execution === 'compiled') element.setProps(next);
          else setElementProps(element, next);
          await flush(target);
        };
        await update(props);
        host.append(element);
        await flush(target);
        handle = element;
        unmount = () => {
          element.remove();
          if (execution === 'compiled') element.dispose();
        };
      }
      active = {
        host,
        handle,
        props,
        update,
        close: async () => {
          unmount();
          await flush(target);
        },
      };
    },
    async setProps(next: Partial<Props>) {
      if (!active) throw new Error('No owner');
      active.props = { ...active.props, ...next };
      await active.update(active.props);
    },
    read,
    startTrace() {
      stop();
      frames = [read()];
      tracing = true;
      raf = requestAnimationFrame(sample);
    },
    trace() {
      return [...frames];
    },
    stopTrace() {
      stop();
      frames.push(read());
      return [...frames];
    },
    async resize(width: number) {
      const root = active?.host.firstElementChild as HTMLElement | null;
      if (!root) throw new Error('No view');
      root.style.width = width + 'px';
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
    close,
  };
}
