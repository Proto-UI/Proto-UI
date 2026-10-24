import * as React from '../../../packages/adapters/react/node_modules/react';
import { createRoot } from '../../../packages/adapters/react/node_modules/react-dom/client';
import * as Vue from '../../../packages/adapters/vue/node_modules/vue';
import Vue2 from '../../../packages/adapters/vue2/node_modules/vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype } from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
let changeExpanded;
let changeDisabled;
let destroy;
let original;
const events = [];
async function mount(runtime) {
  const proto = definePrototype({
    name: `self-hit-${runtime}-native`,
    setup(def) {
      asSwitchRoot();
      const hit = asHitParticipation();
      let release;
      const setExpanded = (value) => {
        if (value && !release)
          release = hit.registerSelfRegion({
            staticHitInset: {
              top: { value: 0.5, unit: 'rem' },
              right: { value: 0.75, unit: 'rem' },
              bottom: { value: 0.5, unit: 'rem' },
              left: { value: 0.75, unit: 'rem' },
            },
          });
        if (!value && release) {
          release();
          release = void 0;
        }
      };
      changeExpanded = setExpanded;
      def.lifecycle.onUnmounted(() => setExpanded(false));
      def.lifecycle.onBeforeDispose(() => setExpanded(false));
    },
  });
  const style = document.createElement('style');
  style.textContent =
    'html{font-size:16px}body{margin:80px;font:16px Arial}[role=switch]{position:relative;display:inline-flex;box-sizing:border-box;width:32px;height:20px;border:1px solid transparent;border-radius:18px;background:rgb(180,180,180)}[role=switch][aria-checked=true]{background:rgb(50,50,50)}[role=switch]:focus-visible{outline:3px solid blue}';
  document.head.append(style);
  const host = document.createElement('main');
  document.body.append(host);
  if (runtime === 'wc') {
    AdaptToWebComponent(proto);
    const root = document.createElement(proto.name);
    host.append(root);
    changeDisabled = (disabled2) => setElementProps(root, { disabled: disabled2 });
    destroy = () => root.remove();
  } else if (runtime === 'react') {
    const adapt = createReactAdapter(React),
      Component = adapt(proto),
      app = createRoot(host);
    const render = (disabled2 = false) =>
      app.render(React.createElement(Component, { disabled: disabled2 }));
    render();
    changeDisabled = render;
    destroy = () => app.unmount();
  } else if (runtime === 'vue') {
    const adapt = createVueAdapter(Vue),
      Component = adapt(proto),
      props = Vue.reactive({ disabled: false });
    const app = Vue.createApp({ render: () => Vue.h(Component, props) });
    app.mount(host);
    changeDisabled = (value) => {
      props.disabled = value;
    };
    destroy = () => app.unmount();
  } else if (runtime === 'vue2') {
    const adapt = createVue2Adapter(Vue2),
      Component = adapt(proto),
      props = Vue2.observable({ disabled: false });
    const app = new Vue2({
      render: (h) => h(Component, { attrs: { disabled: props.disabled } }),
    }).$mount();
    host.append(app.$el);
    changeDisabled = (value) => {
      props.disabled = value;
    };
    destroy = () => {
      app.$destroy();
      app.$el.remove();
    };
  } else throw Error('Unknown runtime');
  for (let i = 0; i < 100 && !host.querySelector('[role=switch]'); i++)
    await new Promise((r) => setTimeout(r, 0));
  const roots = host.querySelectorAll('[role=switch]');
  if (roots.length !== 1) throw Error(`Expected one actual Switch root: ${runtime}`);
  original = roots[0];
  for (const type of ['pointerdown', 'pointerup', 'click'])
    original.addEventListener(type, (e) => events.push({ type, trusted: e.isTrusted }));
  return sample();
}
function expanded(value) {
  changeExpanded(value);
  return sample();
}
function disabled(value) {
  changeDisabled(value);
}
function dispose() {
  destroy();
}
function sample() {
  const root = document.querySelector('[role=switch]');
  const box = original.getBoundingClientRect();
  return {
    same: root === original,
    connected: original.isConnected,
    marked: original.hasAttribute('data-pui-static-hit'),
    checked: original.getAttribute('aria-checked'),
    disabled: original.getAttribute('aria-disabled'),
    focused: document.activeElement === original,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    events: events.slice(),
    text: document.body.textContent,
  };
}
export { disabled, dispose, expanded, mount, sample };
