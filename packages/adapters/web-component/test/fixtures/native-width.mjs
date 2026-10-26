import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from 'vue2-runtime';
import { AdaptToWebComponent, setElementProps } from '../../src';
import { createReactAdapter } from '../../../react/src';
import { createVueAdapter } from '../../../vue/src';
import { createVue2Adapter } from '../../../vue2/src';
import { ShadcnInputRoot } from '../../../../prototypes/shadcn/src/input/root.proto';
import { ShadcnTextareaRoot } from '../../../../prototypes/shadcn/src/textarea/root.proto';

const prototypes = { input: ShadcnInputRoot, textarea: ShadcnTextareaRoot };
const react = createReactAdapter(React);
const vue = createVueAdapter(Vue);
const vue2 = createVue2Adapter({
  extend: Vue2.extend.bind(Vue2),
  nextTick: Vue2.nextTick.bind(Vue2),
  set: Vue2.set.bind(Vue2),
  delete: Vue2.delete.bind(Vue2),
});
export async function mount(runtime, kind, host, props) {
  const proto = prototypes[kind];
  if (runtime === 'wc') {
    const name = `width-${proto.name}`;
    if (!customElements.get(name)) AdaptToWebComponent(proto, { registerAs: name });
    const node = document.createElement(name);
    setElementProps(node, props);
    host.append(node);
  } else if (runtime === 'react') {
    createRoot(host).render(React.createElement(react(proto), props));
  } else if (runtime === 'vue') {
    Vue.createApp(vue(proto), props).mount(host);
  } else {
    const component = vue2(proto);
    const mountPoint = document.createElement('div');
    host.append(mountPoint);
    new Vue2({ render: (h) => h(component, { attrs: props }) }).$mount(mountPoint);
  }
  for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
}
