import { describe, expect, it } from 'vitest';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../../../prototypes/base/src/tabs';

import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: base tabs compound protocol', () => {
  it('coordinates context, anatomy, slots, and trigger activation through Vue 2 VNodes', async () => {
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(tabsRoot);
    const List = adapt(tabsList);
    const Trigger = adapt(tabsTrigger);
    const Content = adapt(tabsContent);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const App = Vue2Any.extend({
      render(h: any) {
        return h(Root, { attrs: { defaultValue: 'a' }, ref: 'root' }, [
          h(List, { attrs: { a11yLabel: 'Vue2 tabs' }, ref: 'list' }, [
            h(Trigger, { attrs: { value: 'a' }, ref: 'triggerA' }, ['A']),
            h(Trigger, { attrs: { value: 'b' }, ref: 'triggerB' }, ['B']),
          ]),
          h(Content, { attrs: { value: 'a' }, ref: 'contentA' }, ['A panel']),
          h(Content, { attrs: { value: 'b' }, ref: 'contentB' }, ['B panel']),
          h(Content, { attrs: { value: 'c', keepMounted: true }, ref: 'contentC' }, ['C panel']),
        ]);
      },
    });
    const vm = new App().$mount();
    host.appendChild(vm.$el);

    try {
      await flushVue2();
      await flushVue2();

      const refs = vm.$refs as Record<string, any>;
      expect(refs.list?.$el.getAttribute('role')).toBe('tablist');
      expect(refs.list?.$el.getAttribute('aria-label')).toBe('Vue2 tabs');
      expect(refs.root?.getExposes().value.get()).toBe('a');
      expect(refs.triggerA?.getExposes().selected.get()).toBe(true);
      expect(refs.contentA?.getExposes().current.get()).toBe(true);
      expect(host.textContent).not.toContain('B panel');
      expect(host.textContent).toContain('C panel');

      refs.triggerB?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue2();
      await flushVue2();

      expect(refs.root?.getExposes().value.get()).toBe('b');
      expect(refs.triggerA?.getExposes().selected.get()).toBe(false);
      expect(refs.triggerB?.getExposes().selected.get()).toBe(true);
      expect(refs.contentA?.getExposes().current.get()).toBe(false);
      expect(refs.contentB?.getExposes().current.get()).toBe(true);
      expect(host.textContent).toContain('B panel');
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
