import { definePrototype, tw } from '../../../../core/src';
import { AdaptToWebComponent } from '../../../web-component/src';
import { createReactAdapter } from '../../src';
import { createVueAdapter } from '../../../vue/src';
import { createVue2Adapter } from '../../../vue2/src';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as VueRuntime from '../../../../../apps/www/node_modules/vue';
const Vue = VueRuntime as any;
import Vue2 from '../../../vue2/node_modules/vue';

const framework = new URL(location.href).searchParams.get('adapter') ?? 'wc';
if (!['wc', 'react', 'vue', 'vue2'].includes(framework)) throw new Error('Unknown adapter');
let renders = 0,
  setups = 0;
const proto = definePrototype({
  name: 'owned-decoration-web-' + framework,
  setup(def) {
    setups++;
    const first = def.feedback.style.declareDecoration();
    const second = def.feedback.style.declareDecoration();
    const active = def.state.bool('active', false);
    def.feedback.style.use(tw('block p-4'));
    def.feedback.style.to(first).use(tw('block h-4 w-16 bg-black opacity-50'));
    def.feedback.style.to(second).use(tw('block h-4 w-16 bg-black'));
    def.rule({
      when: (w) => w.state(active).eq(true),
      intent: (i) => i.feedback.style.to(first).use(tw('bg-white opacity-100')),
    });
    def.event.on('host:click', () => active.set(!active.get()));
    def.event.on('key.down', (_run, e) => {
      if (e.key === 'F2') {
        e.control.requestDefaultActionPrevention();
        active.set(!active.get());
      }
    });
    return (r) => {
      renders++;
      return [r.decoration(first), r.el('section', r.slot()), r.decoration(second)];
    };
  },
});
const main = document.querySelector('main')!;
const tick = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
let dispose: () => void;
let cycle: (() => Promise<void> | void) | undefined;
let cycleHiddenUnchanged = true;
const hiddenProbe = () => {
  const nodes = [...main.querySelectorAll('[data-pui-owned-decoration]')];
  const button = document.querySelector<HTMLButtonElement>('#caller-toggle')!;
  const before = nodes.map((n) => n.outerHTML);
  return () => {
    button.click();
    cycleHiddenUnchanged = nodes.every((n, i) => n.outerHTML === before[i]);
  };
};
if (framework === 'wc') {
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name);
  const input = document.createElement('input');
  input.id = 'caller-editor';
  input.value = 'preserve selection';
  input.setAttribute('aria-label', 'Caller editor');
  const button = document.createElement('button');
  button.id = 'caller-toggle';
  button.textContent = 'Toggle decoration';
  host.append(input, button);
  main.append(host);
  dispose = () => host.remove();
} else if (framework === 'react') {
  const Component = createReactAdapter(React)(proto, { autoUpdateOnPropsChange: false });
  let setMode!: (v: 'visible' | 'hidden') => void;
  function App() {
    const [mode, set] = React.useState<'visible' | 'hidden'>('visible');
    setMode = set;
    return React.createElement(React.Activity, {
      mode,
      children: React.createElement(
        Component,
        {},
        React.createElement('input', {
          id: 'caller-editor',
          defaultValue: 'preserve selection',
          'aria-label': 'Caller editor',
        }),
        React.createElement('button', { id: 'caller-toggle' }, 'Toggle decoration')
      ),
    });
  }
  const root = createRoot(main);
  flushSync(() => root.render(React.createElement(React.StrictMode, {}, React.createElement(App))));
  cycle = () => {
    const probe = hiddenProbe();
    flushSync(() => setMode('hidden'));
    probe();
    flushSync(() => setMode('visible'));
  };
  dispose = () => flushSync(() => root.unmount());
} else if (framework === 'vue') {
  const Component = createVueAdapter(Vue as any)(proto, { autoUpdateOnPropsChange: false });
  const visible = Vue.ref(true);
  const app = Vue.createApp({
    render: () =>
      Vue.h(Vue.KeepAlive, null, {
        default: () =>
          visible.value
            ? Vue.h(Component, { key: 'owner' }, () => [
                Vue.h('input', {
                  id: 'caller-editor',
                  value: 'preserve selection',
                  'aria-label': 'Caller editor',
                }),
                Vue.h('button', { id: 'caller-toggle' }, 'Toggle decoration'),
              ])
            : null,
      }),
  });
  app.mount(main);
  cycle = async () => {
    const probe = hiddenProbe();
    visible.value = false;
    await Vue.nextTick();
    probe();
    visible.value = true;
    await Vue.nextTick();
  };
  dispose = () => app.unmount();
} else {
  const V = Vue2 as any;
  const Component = createVue2Adapter({
    extend: V.extend.bind(V),
    nextTick: V.nextTick.bind(V),
    set: V.set.bind(V),
    delete: V.delete.bind(V),
  })(proto, { autoUpdateOnPropsChange: false });
  const App = V.extend({
    data: () => ({ visible: true }),
    render(this: any, h: any) {
      return h('div', [
        h('keep-alive', [
          this.visible
            ? h(Component, { key: 'owner' }, [
                h('input', {
                  attrs: { id: 'caller-editor', 'aria-label': 'Caller editor' },
                  domProps: { value: 'preserve selection' },
                }),
                h('button', { attrs: { id: 'caller-toggle' } }, 'Toggle decoration'),
              ])
            : null,
        ]),
      ]);
    },
  });
  const vm = new App().$mount();
  main.append(vm.$el);
  cycle = async () => {
    const probe = hiddenProbe();
    vm.visible = false;
    await V.nextTick();
    probe();
    vm.visible = true;
    await V.nextTick();
  };
  dispose = () => {
    vm.$destroy();
    vm.$el.remove();
  };
}
await tick();
await tick();
const input = document.querySelector<HTMLInputElement>('#caller-editor')!;
const initialLeaves = [...main.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
let expectedLeaves = initialLeaves;
let originalRenders = renders;
const evidence = {
  framework,
  input,
  dispose,
  get leaves() {
    return [...main.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
  },
  snapshot() {
    const leaves = this.leaves;
    const host = leaves[0]?.parentElement;
    return {
      framework,
      setups,
      renders,
      originalRenders,
      stable:
        leaves.length === expectedLeaves.length && leaves.every((n, i) => n === expectedLeaves[i]),
      callerStable: document.querySelector('#caller-editor') === input,
      value: input.value,
      selection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
      focus: document.activeElement?.id,
      hostTokens: host?.getAttribute('data-pui-style'),
      cycleHiddenUnchanged,
      leaves: leaves.map((node) => ({
        tokens: node.getAttribute('data-pui-style'),
        color: getComputedStyle(node).backgroundColor,
        opacity: getComputedStyle(node).opacity,
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        hidden: node.getAttribute('aria-hidden'),
        inert: node.hasAttribute('inert'),
        tabIndex: node.tabIndex,
        pointer: getComputedStyle(node).pointerEvents,
        children: node.childNodes.length,
      })),
    };
  },
  async runCycle() {
    if (!cycle) throw new Error('No retained-owner cycle for this profile');
    await cycle();
    await tick();
    expectedLeaves = this.leaves;
    originalRenders = renders;
    document.documentElement.dataset.cycled = 'true';
  },
};
(window as any).decorationWebEvidence = evidence;
const control = document.createElement('button');
control.id = 'lifecycle-cycle';
control.textContent = 'Exercise retained-owner lifecycle';
control.disabled = !cycle;
control.onclick = () => {
  void evidence.runCycle();
};
document.body.append(control);
document.documentElement.dataset.ready = 'true';
