import { describe, expect, it } from 'vitest';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../../../prototypes/base/src/tabs';

import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: base tabs compound protocol', () => {
  it('matches exact-key parts and recovers after removing an ambiguous counterpart', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(tabsRoot);
    const List = adapt(tabsList);
    const Trigger = adapt(tabsTrigger);
    const Content = adapt(tabsContent);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const App = Vue2Any.extend({
      data: () => ({ duplicate: true }),
      render(h: any) {
        return h(Root, { attrs: { defaultValue: 'a+b' } }, [
          h(
            List,
            {},
            ['a+b', 'a b', 'missing', 'duplicate'].map((value, index) =>
              h(Trigger, { attrs: { value }, key: index, ref: `trigger${index}` }, [value])
            )
          ),
          ...['a+b', 'a b', 'duplicate', 'duplicate'].flatMap((value, index) =>
            index === 3 && !this.duplicate
              ? []
              : [
                  h(
                    Content,
                    {
                      attrs: { value, keepMounted: true },
                      key: index,
                      ref: `content${index}`,
                    },
                    [value]
                  ),
                ]
          ),
        ]);
      },
    });
    const vm = new App();
    try {
      vm.$mount();
      host.appendChild(vm.$el);
      await flushVue2();
      await flushVue2();
      const refs = vm.$refs as Record<string, any>;
      expect(refs.content0.$el.id).not.toBe('');
      expect(refs.content1.$el.id).not.toBe('');
      expect(refs.content0.$el.id).not.toBe(refs.content1.$el.id);
      for (const index of [0, 1]) {
        expect(refs[`trigger${index}`].$el.getAttribute('aria-controls')).toBe(
          refs[`content${index}`].$el.id
        );
        expect(refs[`content${index}`].$el.getAttribute('aria-labelledby')).toBe(
          refs[`trigger${index}`].$el.id
        );
      }
      expect(refs.trigger2.$el.hasAttribute('aria-controls')).toBe(false);
      expect(refs.trigger3.$el.hasAttribute('aria-controls')).toBe(false);

      vm.duplicate = false;
      await flushVue2();
      await flushVue2();
      expect(refs.trigger3.$el.getAttribute('aria-controls')).toBe(refs.content2.$el.id);
    } finally {
      vm.$destroy();
      host.remove();
      await flushVue2();
    }
  });

  it('isolates same-key relationships in adjacent and nested domains', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(tabsRoot);
    const List = adapt(tabsList);
    const Trigger = adapt(tabsTrigger);
    const Content = adapt(tabsContent);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const App = Vue2Any.extend({
      render(h: any) {
        const domain = (name: string): any =>
          h(Root, { attrs: { defaultValue: 'shared' } }, [
            h(List, {}, [
              h(Trigger, { attrs: { value: 'shared' }, ref: `${name}Trigger` }, [name]),
            ]),
            h(Content, { attrs: { value: 'shared', keepMounted: true }, ref: `${name}Content` }, [
              name,
            ]),
            ...(name === 'outer' ? [domain('nested')] : []),
          ]);
        return h('div', {}, [domain('outer'), domain('adjacent')]);
      },
    });
    const vm = new App();
    try {
      vm.$mount();
      host.appendChild(vm.$el);
      await flushVue2();
      await flushVue2();
      const refs = vm.$refs as Record<string, any>;
      const ids = ['outer', 'nested', 'adjacent'].map((name) => {
        const trigger = refs[`${name}Trigger`].$el;
        const content = refs[`${name}Content`].$el;
        expect(content.id).not.toBe('');
        expect(trigger.getAttribute('aria-controls')).toBe(content.id);
        expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
        return content.id;
      });
      expect(new Set(ids).size).toBe(3);
    } finally {
      vm.$destroy();
      host.remove();
      await flushVue2();
    }
  });

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
      const firstContentId = refs.contentA.$el.id;
      expect(firstContentId).not.toBe('');
      expect(refs.triggerA.$el.getAttribute('aria-controls')).toBe(firstContentId);
      expect(refs.triggerB.$el.hasAttribute('aria-controls')).toBe(false);
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
      expect(refs.triggerA.$el.hasAttribute('aria-controls')).toBe(false);
      expect(refs.triggerB.$el.getAttribute('aria-controls')).toBe(refs.contentB.$el.id);

      refs.triggerA.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue2();
      await flushVue2();
      expect(refs.root.getExposes().value.get()).toBe('a');
      expect(refs.contentA.$el.id).toBe(firstContentId);
      expect(refs.triggerA.$el.getAttribute('aria-controls')).toBe(firstContentId);
      expect(refs.contentA.$el.getAttribute('aria-labelledby')).toBe(refs.triggerA.$el.id);
      expect(refs.triggerB.$el.hasAttribute('aria-controls')).toBe(false);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
