import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { describe, expect, it } from 'vitest';
import { createReactAdapter } from '../../adapters/react/src';
import { createVueAdapter } from '../../adapters/vue/src';
import { createVue2Adapter } from '../../adapters/vue2/src';
import { Vue2Any, Vue2RuntimeAny } from '../../adapters/vue2/test/utils/vue2';
import { AdaptToWebComponent } from '../../adapters/web-component/src';
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '../../prototypes/shadcn/src/card';

const parts = [ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent, ShadcnCardFooter];
const constructors = parts.map((part) => AdaptToWebComponent(part));
const href = '#native-card-destination';
async function settle() {
  await Promise.resolve();
  await Vue.nextTick();
  await Vue2Any.nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Synthetic DOM Adapter execution is not native browser paint/first-frame evidence.
describe.each(['wc', 'react', 'vue', 'vue2'] as const)(
  'Shadcn Card actual %s adapter harness',
  (runtime) => {
    it('preserves all four passive parts and the native anchor through mount and teardown', async () => {
      const owner = document.createElement('div');
      document.body.append(owner);
      let unmount: () => void;
      if (runtime === 'wc') {
        const [root, header, content, footer] = constructors.map((C) => new C());
        header.textContent = 'Heading';
        content.textContent = 'Body';
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = 'Read';
        footer.append(anchor);
        root.append(header, content, footer);
        owner.append(root);
        unmount = () => root.remove();
      } else if (runtime === 'react') {
        const [Root, Header, Content, Footer] = parts.map((p) => createReactAdapter(React)(p));
        const root = createRoot(owner);
        flushSync(() =>
          root.render(
            React.createElement(
              Root,
              null,
              React.createElement(Header, null, 'Heading'),
              React.createElement(Content, null, 'Body'),
              React.createElement(Footer, null, React.createElement('a', { href }, 'Read'))
            )
          )
        );
        unmount = () => flushSync(() => root.unmount());
      } else if (runtime === 'vue') {
        const [Root, Header, Content, Footer] = parts.map((p) => createVueAdapter(Vue)(p));
        const app = Vue.createApp({
          render: () =>
            Vue.h(Root, null, {
              default: () => [
                Vue.h(Header, null, { default: () => 'Heading' }),
                Vue.h(Content, null, { default: () => 'Body' }),
                Vue.h(Footer, null, { default: () => Vue.h('a', { href }, 'Read') }),
              ],
            }),
        });
        app.mount(owner);
        unmount = () => app.unmount();
      } else {
        const [Root, Header, Content, Footer] = parts.map((p) =>
          createVue2Adapter(Vue2RuntimeAny)(p)
        );
        const vm = new Vue2Any({
          render(h: any) {
            return h(Root, [
              h(Header, ['Heading']),
              h(Content, ['Body']),
              h(Footer, [h('a', { attrs: { href } }, ['Read'])]),
            ]);
          },
        }).$mount();
        owner.append(vm.$el);
        unmount = () => {
          vm.$destroy();
          vm.$el.remove();
        };
      }
      try {
        await settle();
        const nodes = owner.querySelectorAll<HTMLElement>('[data-pui-style]');
        expect(nodes).toHaveLength(4);
        for (const node of nodes) {
          expect(node.hasAttribute('role')).toBe(false);
          expect(node.hasAttribute('tabindex')).toBe(false);
          expect(node.tabIndex).toBe(-1);
        }
        const root = owner.firstElementChild!;
        expect(root.getAttribute('data-pui-style')).toContain('bg-card');
        expect(root.getAttribute('data-pui-style')).toContain('text-card-foreground');
        expect(root.textContent).toContain('Heading');
        expect(root.textContent).toContain('Body');
        const anchor = owner.querySelector('a')!;
        let clicks = 0;
        anchor.addEventListener('click', (event) => {
          event.preventDefault();
          clicks++;
        });
        expect(anchor.getAttribute('href')).toBe(href);
        anchor.click();
        expect(clicks).toBe(1);
      } finally {
        unmount!();
        await settle();
        expect(owner.querySelector('a')).toBeNull();
        owner.remove();
      }
    });
  }
);
