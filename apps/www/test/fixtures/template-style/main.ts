import 'virtual:template-style.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as Vue from 'vue';
import Vue2 from 'vue2-runtime';
import { definePrototype, tw } from '@proto.ui/core';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { configureTemplateStyle } from '../../../../../packages/adapters/web-component/src/style';
import { CALLER_STYLE, OWNED_STYLE } from './tokens';
import { captureTemplateOwnership } from './ownership';

type Entry = { host: HTMLElement; update(): void; dispose(): void };
const entries: Entry[] = [];
let phase = 'styled';
let resolverInput: string | null = null;
const protoFor = (runtime: string) =>
  definePrototype({
    name: `template-carrier-${runtime}`,
    setup(def) {
      def.feedback.style.use(tw('p-1'));
      return (r) =>
        r.el('section', [
          r.el(
            'span',
            {
              style: phase === 'styled' ? tw(OWNED_STYLE) : phase === 'empty' ? tw('') : undefined,
            },
            'owned'
          ),
          r.slot(),
        ]);
    },
  });
const slotAttrs = { 'data-caller-slot': '', 'data-pui-style': CALLER_STYLE };
for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
  const card = document.createElement('article');
  card.dataset.runtime = runtime;
  const title = document.createElement('h2');
  title.textContent = runtime;
  const host = document.createElement('div');
  card.append(title, host);
  document.getElementById('fixtures')!.append(card);
  const proto = protoFor(runtime);
  if (runtime === 'wc') {
    AdaptToWebComponent(proto);
    const root = document.createElement(proto.name) as HTMLElement & { update(): void };
    root.className = 'caller-root p-8';
    root.setAttribute('data-pui-style', 'p-8');
    const slot = document.createElement('b');
    Object.entries(slotAttrs).forEach(([key, value]) => slot.setAttribute(key, value));
    slot.className = 'caller-slot p-8';
    slot.textContent = 'caller';
    root.append(slot);
    host.append(root);
    entries.push({ host, update: () => root.update(), dispose: () => root.remove() });
  } else if (runtime === 'react') {
    const Component = createReactAdapter(React)(proto);
    const ref = React.createRef<any>();
    const root = createRoot(host);
    flushSync(() =>
      root.render(
        React.createElement(
          Component,
          { ref, className: 'caller-root p-8', 'data-pui-style': 'p-8' },
          React.createElement('b', { ...slotAttrs, className: 'caller-slot p-8' }, 'caller')
        )
      )
    );
    entries.push({
      host,
      update: () => flushSync(() => ref.current.update()),
      dispose: () => root.unmount(),
    });
  } else if (runtime === 'vue') {
    const Component = createVueAdapter(Vue)(proto);
    const ref = Vue.ref<any>(null);
    const app = Vue.createApp({
      render: () =>
        Vue.h(Component, { ref, class: 'caller-root p-8', 'data-pui-style': 'p-8' }, () => [
          Vue.h('b', { ...slotAttrs, class: 'caller-slot p-8' }, 'caller'),
        ]),
    });
    app.mount(host);
    entries.push({ host, update: () => ref.value.update(), dispose: () => app.unmount() });
  } else {
    const Component = createVue2Adapter(Vue2 as any)(proto);
    const App = Vue2.extend({
      render(h: any) {
        return h(
          Component,
          { ref: 'target', class: 'caller-root p-8', attrs: { 'data-pui-style': 'p-8' } },
          [h('b', { attrs: slotAttrs, class: 'caller-slot p-8' }, 'caller')]
        );
      },
    });
    const vm = new App().$mount();
    host.append(vm.$el);
    entries.push({
      host,
      update: () => (vm.$refs.target as any).update(),
      dispose: () => {
        vm.$destroy();
        host.replaceChildren();
      },
    });
  }
}
async function settle() {
  await Vue.nextTick();
  await Vue2.nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}
async function initializeFixture() {
  const { originalRoots, originalSlots, originalRootCarriers } = await captureTemplateOwnership(
    entries,
    settle
  );
  (window as any).templateStyleFixture = {
    async update(next: string) {
      phase = next;
      entries.forEach((entry) => entry.update());
      await settle();
    },
    async resolver() {
      configureTemplateStyle({
        tw: (input) => {
          resolverInput = input;
          return 'padding: 3px; background-color: rgb(22, 163, 74);';
        },
      });
      phase = 'styled';
      entries[0]!.update();
      await settle();
    },
    facts() {
      return entries.map(({ host }, index) => {
        const root = host.querySelector('[data-pui-root]');
        const owned = host.querySelector('span');
        const slot = host.querySelector('[data-caller-slot]');
        return {
          rootIdentity: root === originalRoots[index],
          rootCarrier: root?.getAttribute('data-pui-style'),
          originalRootCarrier: originalRootCarriers[index],
          slotIdentity: slot === originalSlots[index],
          slotClass: slot?.className,
          slotCarrier: slot?.getAttribute('data-pui-style'),
          ownedCarrier: owned?.getAttribute('data-pui-style'),
          ownedClass: owned?.getAttribute('class'),
          padding: owned ? getComputedStyle(owned).paddingTop : null,
          background: owned ? getComputedStyle(owned).backgroundColor : null,
          inlineStyle: owned?.getAttribute('style'),
          resolverInput,
        };
      });
    },
    async dispose() {
      entries.forEach((entry) => entry.dispose());
      configureTemplateStyle({});
      await settle();
    },
  };
  document.body.dataset.ready = 'true';
}
void initializeFixture();
