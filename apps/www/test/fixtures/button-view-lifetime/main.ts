import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import * as Vue from 'vue';
import Vue2 from '../../../../../packages/adapters/vue2/node_modules/vue';
import { definePrototype, type RunHandle } from '@proto.ui/core';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import ShadcnButton from '@proto.ui/prototypes-shadcn/button';
import BrutalistButton from '@proto.ui/prototypes-brutalist/button';
import {
  toVue2Runtime,
  toVue2ComponentData,
} from '../../../src/components/PrototypePreviewer/runtimes/vue2-runtime';

const params = new URLSearchParams(location.search);
const runtime = params.get('runtime') ?? 'wc';
const family = params.get('family') ?? 'brutalist';
const Source = family === 'shadcn' ? ShadcnButton : BrutalistButton;
await import(/* @vite-ignore */ `/@id/__x00__virtual:button-${family}.css`);
document.querySelector('#description')!.textContent = `Real ${family} Button · ${runtime}`;

let handle: any;
let disabled = false;
const stats = {
  setups: 0,
  clicks: 0,
  phases: [] as Array<{ phase: string; epoch: number }>,
  unmounts: 0,
  disposed: false,
};
// The consumer adds only a public ViewIntent control and lifetime observations.
const Probe = definePrototype<any, any>({
  name: 'button-view-lifetime-probe',
  setup(def) {
    stats.setups++;
    const render = Source.setup(def);
    let run!: RunHandle<any>;
    def.lifecycle.onCreated((current) => {
      run = current;
    });
    def.expose.method('setPresent', (present: boolean) => run.lifecycle.setPresent(present));
    def.lifecycle.onUnmounted(() => {
      stats.unmounts++;
    });
    return render;
  },
});
const options = {
  diagnostics: {
    onLifecycleEvent(event: any) {
      if (event.type === 'mount.phase')
        stats.phases.push({ phase: event.phase, epoch: event.epoch });
      if (event.type === 'instance.dispose.done') stats.disposed = true;
    },
  },
};
const host = document.querySelector<HTMLElement>('#app')!;
const ids = ['control', 'probe'] as const;
const label = (id: string) => (id === 'control' ? 'Untouched control' : 'Retained owner');
const props = (id: string) => ({
  'data-demo-ref': id,
  disabled: id === 'probe' && disabled,
  ...(id === 'probe'
    ? {
        onClick: () => {
          stats.clicks++;
        },
      }
    : {}),
});
let update: () => void;
let dispose: () => void;

if (runtime === 'wc') {
  const types = {
    control: AdaptToWebComponent(Source, { registerAs: 'lifetime-button-control' }),
    probe: AdaptToWebComponent(Probe, { registerAs: 'lifetime-button-probe', ...options }),
  };
  const section = document.createElement('section');
  for (const id of ids) {
    const article = document.createElement('article');
    const caption = document.createElement('p');
    caption.textContent = label(id);
    const element = new types[id]();
    element.dataset.demoRef = id;
    element.textContent = 'Continue';
    setElementProps(element, { disabled: false });
    if (id === 'probe') {
      handle = element;
      element.addEventListener('click', (event) => {
        // WC exposes protocol signals as CustomEvents alongside native clicks.
        if (event instanceof CustomEvent) stats.clicks++;
      });
    }
    article.append(caption, element);
    section.append(article);
  }
  host.append(section);
  update = () => setElementProps(handle, { disabled });
  dispose = () => host.replaceChildren();
} else if (runtime === 'react') {
  const adapt = createReactAdapter({ ...React, createPortal });
  const types = { control: adapt(Source), probe: adapt(Probe, options) };
  const root = createRoot(host);
  update = () =>
    root.render(
      React.createElement(
        'section',
        null,
        ...ids.map((id) =>
          React.createElement(
            'article',
            { key: id },
            React.createElement('p', null, label(id)),
            React.createElement(
              types[id],
              {
                ...props(id),
                ...(id === 'probe'
                  ? {
                      ref: (value: any) => {
                        if (value) handle = value;
                      },
                    }
                  : {}),
              },
              'Continue'
            )
          )
        )
      )
    );
  dispose = () => root.unmount();
  update();
} else if (runtime === 'vue') {
  const adapt = createVueAdapter(Vue as any);
  const types = { control: adapt(Source), probe: adapt(Probe, options) };
  const revision = Vue.ref(0);
  const app = Vue.createApp({
    render() {
      void revision.value;
      return Vue.h(
        'section',
        ids.map((id) =>
          Vue.h('article', [
            Vue.h('p', label(id)),
            Vue.h(
              types[id],
              {
                ...props(id),
                ...(id === 'probe'
                  ? {
                      ref: (value: any) => {
                        if (value) handle = value;
                      },
                    }
                  : {}),
              },
              { default: () => 'Continue' }
            ),
          ])
        )
      );
    },
  });
  app.mount(host);
  update = () => {
    revision.value++;
  };
  dispose = () => app.unmount();
} else if (runtime === 'vue2') {
  const adapt = createVue2Adapter(toVue2Runtime(Vue2 as any));
  const types = { control: adapt(Source), probe: adapt(Probe, options) };
  const app = new Vue2({
    render(h: any) {
      return h(
        'section',
        ids.map((id) =>
          h('article', [
            h('p', label(id)),
            h(
              types[id],
              {
                ...toVue2ComponentData(props(id)),
                ...(id === 'probe' ? { ref: 'probe' } : {}),
              },
              ['Continue']
            ),
          ])
        )
      );
    },
  });
  host.append(app.$mount().$el);
  handle = app.$refs.probe;
  update = () => app.$forceUpdate();
  dispose = () => {
    app.$destroy();
    app.$el.remove();
  };
} else throw new Error(`Unsupported runtime ${runtime}`);

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
await settle();
const firstExposes = handle.getExposes();
const firstNode = document.querySelector('[data-demo-ref="probe"]');
const inputs: Array<{ type: string; trusted: boolean; buttons: number; target: string | null }> =
  [];
for (const type of ['pointerdown', 'pointerup']) {
  document.addEventListener(
    type,
    (event) => {
      const pointer = event as PointerEvent;
      inputs.push({
        type,
        trusted: event.isTrusted,
        buttons: pointer.buttons,
        target: (event.target as Element).getAttribute('data-demo-ref'),
      });
    },
    true
  );
}
(window as any).buttonLifetime = {
  stats,
  inputs,
  read() {
    const current = handle.getExposes();
    return {
      pressed: current.pressed.get(),
      hovered: current.hovered.get(),
      disabled: current.disabled.get(),
      focusVisible: current.focusVisible.get(),
      sameHandles:
        current.pressed === firstExposes.pressed && current.hovered === firstExposes.hovered,
      sameNode: document.querySelector('[data-demo-ref="probe"]') === firstNode,
      setups: stats.setups,
      clicks: stats.clicks,
      phase: stats.phases.at(-1),
    };
  },
  async setPresent(present: boolean) {
    handle.getExposes().setPresent(present);
    await settle();
  },
  async setDisabled(next: boolean) {
    disabled = next;
    update();
    await settle();
  },
  async dispose() {
    dispose();
    await settle();
  },
};
document.body.dataset.ready = 'true';
