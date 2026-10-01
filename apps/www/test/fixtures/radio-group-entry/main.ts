import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2 from '../../../../../packages/adapters/vue2/node_modules/vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter, type VueRuntime } from '@proto.ui/adapter-vue';
import { createVue2Adapter, type Vue2CreateElement } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { radioGroupRoot, radioGroupItem } from '@proto.ui/prototypes-base/radio-group';
import {
  toVue2ComponentData,
  toVue2Runtime,
} from '../../../src/components/PrototypePreviewer/runtimes/vue2-runtime';

type RootHandle = { getExposes(): { value: { get(): string } } };
const params = new URLSearchParams(location.search);
const runtime = params.get('runtime') ?? 'wc';
const controlled = params.get('mode') === 'controlled';
const host = document.querySelector<HTMLElement>('#app')!;
const items = ['a', 'b', 'c'];
const labels = ['Alpha', 'Beta', 'Gamma'];
const changes: string[] = [];
let value = 'b';
let rootHandle: RootHandle;
let update: () => void;
const rootProps = () => ({
  ...(controlled ? { value } : { defaultValue: 'b' }),
  a11yLabel: 'Delivery method',
});
const onValueChange = (event: { value: string }) => changes.push(event.value);
document.querySelector('#scenario')!.textContent =
  `${runtime} / initial ${controlled ? 'controlled value' : 'defaultValue'} = b`;

if (runtime === 'wc') {
  const Root = AdaptToWebComponent(radioGroupRoot);
  const Item = AdaptToWebComponent(radioGroupItem);
  const root = new Root();
  setElementProps(root, rootProps());
  root.addEventListener('valueChange', (event) =>
    onValueChange((event as CustomEvent<{ value: string }>).detail)
  );
  root.append(
    ...items.map((itemValue, index) => {
      const item = new Item();
      setElementProps(item, { value: itemValue });
      item.textContent = labels[index]!;
      return item;
    })
  );
  host.append(root);
  rootHandle = root as unknown as RootHandle;
  update = () => setElementProps(root, rootProps());
} else if (runtime === 'react') {
  const adapt = createReactAdapter(React);
  const Root = adapt(radioGroupRoot);
  const Item = adapt(radioGroupItem);
  const root = createRoot(host);
  update = () =>
    root.render(
      React.createElement(
        Root,
        {
          ...rootProps(),
          onValueChange,
          ref: (instance: RootHandle | null) => {
            if (instance) rootHandle = instance;
          },
        },
        ...items.map((itemValue, index) =>
          React.createElement(Item, { key: itemValue, value: itemValue }, labels[index])
        )
      )
    );
  update();
} else if (runtime === 'vue') {
  const adapt = createVueAdapter(Vue as unknown as VueRuntime);
  const Root = adapt(radioGroupRoot);
  const Item = adapt(radioGroupItem);
  const revision = Vue.ref(0);
  Vue.createApp({
    render() {
      void revision.value;
      return Vue.h(
        Root,
        {
          ...rootProps(),
          onValueChange,
          ref: (instance: unknown) => {
            if (instance) rootHandle = instance as RootHandle;
          },
        },
        {
          default: () =>
            items.map((itemValue, index) =>
              Vue.h(Item, { key: itemValue, value: itemValue }, () => labels[index])
            ),
        }
      );
    },
  }).mount(host);
  update = () => {
    revision.value++;
  };
} else if (runtime === 'vue2') {
  const adapt = createVue2Adapter(
    toVue2Runtime(Vue2 as unknown as Parameters<typeof toVue2Runtime>[0])
  );
  const Root = adapt(radioGroupRoot);
  const Item = adapt(radioGroupItem);
  const vm = new Vue2({
    render(h: Vue2CreateElement) {
      return h(
        Root,
        { ...toVue2ComponentData({ ...rootProps(), onValueChange }), ref: 'root' },
        items.map((itemValue, index) =>
          h(Item, { ...toVue2ComponentData({ value: itemValue }), key: itemValue }, [
            labels[index]!,
          ])
        )
      );
    },
  });
  host.append(vm.$mount().$el);
  rootHandle = vm.$refs.root as unknown as RootHandle;
  update = () => vm.$forceUpdate();
} else throw new Error(`Unsupported runtime ${runtime}`);

const fixture = {
  read() {
    return {
      value: rootHandle.getExposes().value.get(),
      changes: [...changes],
      items: [...host.querySelectorAll<HTMLElement>('[role="radio"]')].map((item) => ({
        label: item.textContent,
        checked: item.getAttribute('aria-checked'),
        tabIndex: item.tabIndex,
        focused: document.activeElement === item,
      })),
    };
  },
  setValue(next: string) {
    value = next;
    update();
  },
};
declare global {
  interface Window {
    radioEntry: typeof fixture;
  }
}
window.radioEntry = fixture;
await new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
);
document.body.dataset.ready = 'true';
