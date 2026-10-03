import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../../../../packages/adapters/vue2/node_modules/vue';
import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
const stylesheet = '/@id/__x00__virtual:preferences.css';
await import(/* @vite-ignore */ stylesheet);
const params = new URLSearchParams(location.search);
const runtime = params.get('runtime') ?? 'wc';
document.querySelector('#runtime')!.textContent = runtime;
if (params.has('unknown'))
  Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true });
let mounts = 0;
let updates = 0;
const probe = definePrototype({
  name: 'reactive-preference-probe',
  setup(def) {
    asButton();
    def.feedback.style.use(tw('bg-background text-foreground px-5 py-2 rounded-full'));
    def.rule({
      when: (w) =>
        w.all(
          w.meta('preference.reducedMotion').eq('no-preference'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.contrast').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });
    def.lifecycle.onMounted(() => {
      mounts++;
    });
    def.lifecycle.onUpdated(() => {
      updates++;
    });
  },
});
const host = document.querySelector('#app')!;
const options = params.has('custom') ? { getMeta: () => 'no-preference' } : {};
let dispose: () => void;
if (runtime === 'wc') {
  AdaptToWebComponent(probe, options);
  const element = document.createElement(probe.name);
  element.textContent = 'Preference-aware control';
  host.append(element);
  dispose = () => element.remove();
} else if (runtime === 'react') {
  const root = createRoot(host);
  const Component = createReactAdapter(React)(probe, options);
  root.render(React.createElement(Component, {}, 'Preference-aware control'));
  dispose = () => root.unmount();
} else if (runtime === 'vue') {
  const Component = createVueAdapter(Vue as any)(probe, options);
  const app = Vue.createApp({
    render: () => Vue.h(Component, {}, () => 'Preference-aware control'),
  });
  app.mount(host);
  dispose = () => app.unmount();
} else {
  const adapt = createVue2Adapter({
    extend: Vue2.extend.bind(Vue2),
    nextTick: Vue2.nextTick.bind(Vue2),
    set: Vue2.set.bind(Vue2),
    delete: Vue2.delete.bind(Vue2),
  } as any);
  const Component = adapt(probe, options);
  const vm = new Vue2({ render: (h: any) => h(Component, {}, ['Preference-aware control']) });
  host.append(vm.$mount().$el);
  dispose = () => vm.$destroy();
}
(window as any).preferenceFixture = {
  stats: () => ({ mounts, updates }),
  dispose: () => dispose(),
};
document.body.dataset.ready = 'true';
