import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as Vue from 'vue';
import Vue2Import from 'vue2-runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import button from '@proto.ui/prototypes-liquid-glass/button';
import { createPreviewMaterialSink } from '../src/components/PrototypePreviewer/preview-material-provider';

export type MaterialRuntime = 'wc' | 'react' | 'vue' | 'vue2';
export type MaterialView = { destroy(): void };
const options = { createVisualSink: createPreviewMaterialSink };

/** Four real Adapter consumers. No website registry, retry URL or renderer is needed. */
export async function mountMaterialConsumer(
  runtime: MaterialRuntime,
  host: HTMLElement,
  activated: () => void
): Promise<MaterialView> {
  if (runtime === 'wc') {
    const tag = 'material-v2-artifact-button';
    if (!customElements.get(tag)) AdaptToWebComponent(button, { ...options, registerAs: tag });
    const controls = document.createElement('div');
    controls.className = 'controls';
    const regular = document.createElement(tag);
    regular.dataset.demoRef = 'regular';
    regular.textContent = 'Optical action';
    const opaque = document.createElement(tag);
    opaque.textContent = 'Opaque action';
    setElementProps(opaque, { material: 'opaque' });
    const onCommit = (event: Event) => {
      if (event instanceof CustomEvent) activated();
    };
    regular.addEventListener('click', onCommit);
    controls.append(regular, opaque);
    host.append(controls);
    return {
      destroy() {
        regular.removeEventListener('click', onCommit);
        controls.remove();
      },
    };
  }
  if (runtime === 'react') {
    const Button = createReactAdapter(React)(button, options);
    const root = createRoot(host);
    const regularProps = { 'data-demo-ref': 'regular', onClick: activated };
    flushSync(() =>
      root.render(
        React.createElement(
          'div',
          { className: 'controls' },
          React.createElement(Button, regularProps, 'Optical action'),
          React.createElement(Button, { material: 'opaque' }, 'Opaque action')
        )
      )
    );
    return {
      destroy() {
        flushSync(() => root.unmount());
      },
    };
  }
  if (runtime === 'vue') {
    const Button = createVueAdapter(Vue)(button, options);
    const app = Vue.createApp({
      render: () =>
        Vue.h('div', { class: 'controls' }, [
          Vue.h(Button, { 'data-demo-ref': 'regular', onClick: activated }, () => 'Optical action'),
          Vue.h(Button, { material: 'opaque' }, () => 'Opaque action'),
        ]),
    });
    app.mount(host);
    await Vue.nextTick();
    return {
      destroy() {
        app.unmount();
      },
    };
  }
  if (runtime !== 'vue2') throw new Error(`Unsupported material runtime: ${runtime}`);
  const Vue2 = Vue2Import as any;
  const Button = createVue2Adapter({
    extend: Vue2.extend.bind(Vue2),
    nextTick: Vue2.nextTick.bind(Vue2),
    set: Vue2.set.bind(Vue2),
    delete: Vue2.delete.bind(Vue2),
  })(button, options);
  const app = new (Vue2.extend({
    render(h: any) {
      return h('div', { class: 'controls' }, [
        h(Button, { attrs: { 'data-demo-ref': 'regular' }, on: { click: activated } }, [
          'Optical action',
        ]),
        h(Button, { attrs: { material: 'opaque' } }, ['Opaque action']),
      ]);
    },
  }))();
  const mountPoint = document.createElement('div');
  host.append(mountPoint);
  app.$mount(mountPoint);
  await Vue2.nextTick();
  return {
    destroy() {
      app.$destroy();
      app.$el.remove();
    },
  };
}
