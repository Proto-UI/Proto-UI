import { definePrototype, tw } from '../../../../core/src';
import { AdaptToWebComponent } from '../../../web-component/src';
import { createReactAdapter } from '../../src';
import { createVueAdapter } from '../../../vue/src';
import { createVue2Adapter } from '../../../vue2/src';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync, createPortal } from 'react-dom';
import { asOverlay } from '../../../../hooks/src';
import { isWebPortalMaterialSuspended } from '../../../base/src/platform/portal-destination';
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
    const overlay = asOverlay();
    overlay.configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
    def.expose('portalActions', {
      close: () => overlay.close(),
      open: () => overlay.openOverlay(),
    });
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
  const nodes = [...document.querySelectorAll('[data-pui-owned-decoration]')];
  const button = document.querySelector<HTMLButtonElement>('#caller-toggle')!;
  return async () => {
    // Capture after the close checkpoint, not before permitted lease cleanup.
    const before = nodes.map((n) => n.outerHTML);
    button.click();
    await new Promise((r) => setTimeout(r, 0));
    cycleHiddenUnchanged = cycleHiddenUnchanged && nodes.every((n, i) => n.outerHTML === before[i]);
  };
};
let actions: () => { close: () => void; open: () => void };
if (framework === 'wc') {
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name) as HTMLElement & { getExposes(): any };
  const input = document.createElement('input');
  input.id = 'caller-editor';
  input.value = 'preserve selection';
  input.setAttribute('aria-label', 'Caller editor');
  const button = document.createElement('button');
  button.id = 'caller-toggle';
  button.textContent = 'Toggle decoration';
  host.append(input, button);
  main.append(host);
  actions = () => host.getExposes().portalActions;
  dispose = () => host.remove();
} else if (framework === 'react') {
  const Component = createReactAdapter({ ...React, createPortal })(proto, {
    autoUpdateOnPropsChange: false,
  });
  const ref = React.createRef<any>();
  const root = createRoot(main);
  flushSync(() =>
    root.render(
      React.createElement(
        React.StrictMode,
        {},
        React.createElement(
          Component,
          { ref },
          React.createElement('input', {
            id: 'caller-editor',
            defaultValue: 'preserve selection',
            'aria-label': 'Caller editor',
          }),
          React.createElement('button', { id: 'caller-toggle' }, 'Toggle decoration')
        )
      )
    )
  );
  actions = () => ref.current.getExposes().portalActions;
  dispose = () => flushSync(() => root.unmount());
} else if (framework === 'vue') {
  const Component = createVueAdapter(Vue)(proto, { autoUpdateOnPropsChange: false }),
    ref = Vue.ref();
  const app = Vue.createApp({
    render: () =>
      Vue.h(Component, { ref }, () => [
        Vue.h('input', {
          id: 'caller-editor',
          value: 'preserve selection',
          'aria-label': 'Caller editor',
        }),
        Vue.h('button', { id: 'caller-toggle' }, 'Toggle decoration'),
      ]),
  });
  app.mount(main);
  actions = () => ref.value.getExposes().portalActions;
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
    render(this: any, h: any) {
      return h('div', [
        h(Component, { ref: 'portal' }, [
          h('input', {
            attrs: { id: 'caller-editor', 'aria-label': 'Caller editor' },
            domProps: { value: 'preserve selection' },
          }),
          h('button', { attrs: { id: 'caller-toggle' } }, 'Toggle decoration'),
        ]),
      ]);
    },
  });
  const vm = new App().$mount();
  main.append(vm.$el);
  actions = () => vm.$refs.portal.getExposes().portalActions;
  dispose = () => {
    vm.$destroy();
    vm.$el.remove();
  };
}
const until = async (test: () => boolean) => {
  const deadline = performance.now() + 3000;
  while (!test()) {
    if (performance.now() > deadline) throw new Error('Portal view did not settle');
    await new Promise((r) => setTimeout(r, 10));
  }
};
cycle = async () => {
  for (let i = 0; i < 3; i++) {
    const probe = hiddenProbe();
    actions().close();
    await until(() => document.querySelectorAll('[data-pui-owned-decoration]').length === 0);
    await probe();
    actions().open();
    await until(
      () =>
        document.querySelectorAll('[data-pui-owned-decoration]').length === 2 &&
        !!document.querySelector('#caller-toggle')
    );
    await tick();
    await tick();
  }
};
await tick();
await tick();
let input = document.querySelector<HTMLInputElement>('#caller-editor')!;
const initialLeaves = [...document.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
let expectedLeaves = initialLeaves;
let originalRenders = renders;
const evidence = {
  framework,
  get input() {
    return input;
  },
  dispose,
  get leaves() {
    return [...document.querySelectorAll<HTMLElement>('[data-pui-owned-decoration]')];
  },
  snapshot() {
    const leaves = this.leaves;
    const host = leaves[0]?.parentElement;
    return {
      framework,
      portalLocated: !!host && !main.contains(host) && host.isConnected,
      materialSuspended: host ? isWebPortalMaterialSuspended(host) : true,
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
    input = document.querySelector<HTMLInputElement>('#caller-editor')!;
    // Close/open legitimately replaces a physical view. Subsequent no-reset
    // assertions bind to this new view, not to a fabricated cross-close identity.
    expectedLeaves = this.leaves;
    originalRenders = renders;
    document.documentElement.dataset.cycled = 'true';
  },
};
(window as any).decorationWebEvidence = evidence;
const control = document.createElement('button');
control.id = 'lifecycle-cycle';
control.textContent = 'Exercise three portal close/open cycles';
control.disabled = !cycle;
control.onclick = () => {
  void evidence.runCycle();
};
document.body.append(control);
document.documentElement.dataset.ready = 'true';
