import { describe, expect, it } from 'vitest';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../../../prototypes/base/src/tabs';

import { VueAny, flushVue } from './utils/vue';
import { createVueAdapter } from '../src/adapt';

describe('adapter-vue: base tabs compound protocol', () => {
  it('matches exact-key parts and recovers after a duplicate counterpart is removed', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const adapter = createVueAdapter(VueAny);
    const Root = adapter(tabsRoot);
    const List = adapter(tabsList);
    const Trigger = adapter(tabsTrigger);
    const Content = adapter(tabsContent);
    const duplicate = VueAny.ref(true);
    const refs: Record<string, any> = {};
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = VueAny.createApp({
      setup: () => () =>
        VueAny.h(Root, { defaultValue: 'a+b' }, () => [
          VueAny.h(List, {}, () =>
            ['a+b', 'a b', 'missing', 'duplicate'].map((value, index) =>
              VueAny.h(
                Trigger,
                { value, key: index, ref: (el: any) => (refs[`trigger${index}`] = el) },
                () => value
              )
            )
          ),
          ...['a+b', 'a b', 'duplicate', 'duplicate'].flatMap((value, index) =>
            index === 3 && !duplicate.value
              ? []
              : [
                  VueAny.h(
                    Content,
                    {
                      value,
                      keepMounted: true,
                      key: index,
                      ref: (el: any) => (refs[`content${index}`] = el),
                    },
                    () => value
                  ),
                ]
          ),
        ]),
    });
    try {
      app.mount(host);
      await flushVue();
      await flushVue();
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

      duplicate.value = false;
      await flushVue();
      await flushVue();
      expect(refs.trigger3.$el.getAttribute('aria-controls')).toBe(refs.content2.$el.id);
    } finally {
      app.unmount();
      host.remove();
      await flushVue();
    }
  });

  it('isolates same-key relationships in adjacent and nested domains', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const adapter = createVueAdapter(VueAny);
    const Root = adapter(tabsRoot);
    const List = adapter(tabsList);
    const Trigger = adapter(tabsTrigger);
    const Content = adapter(tabsContent);
    const refs: Record<string, any> = {};
    const host = document.createElement('div');
    document.body.appendChild(host);
    const domain = (name: string): any =>
      VueAny.h(Root, { defaultValue: 'shared' }, () => [
        VueAny.h(List, {}, () =>
          VueAny.h(
            Trigger,
            {
              value: 'shared',
              ref: (el: any) => (refs[`${name}Trigger`] = el),
            },
            () => name
          )
        ),
        VueAny.h(
          Content,
          {
            value: 'shared',
            keepMounted: true,
            ref: (el: any) => (refs[`${name}Content`] = el),
          },
          () => name
        ),
        ...(name === 'outer' ? [domain('nested')] : []),
      ]);
    const app = VueAny.createApp({
      setup: () => () => VueAny.h('div', {}, [domain('outer'), domain('adjacent')]),
    });
    try {
      app.mount(host);
      await flushVue();
      await flushVue();
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
      app.unmount();
      host.remove();
      await flushVue();
    }
  });

  it('coordinates tabs context, anatomy, a11y label, trigger activation, and roving focus', async () => {
    const adapter = createVueAdapter(VueAny);
    const Root = adapter(tabsRoot);
    const List = adapter(tabsList);
    const Trigger = adapter(tabsTrigger);
    const Content = adapter(tabsContent);
    const refs: Record<string, any> = {};

    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = VueAny.createApp({
      setup() {
        return () =>
          VueAny.h(Root, { defaultValue: 'a', ref: (el: any) => (refs.root = el) }, () => [
            VueAny.h(List, { a11yLabel: 'Vue tabs', ref: (el: any) => (refs.list = el) }, () => [
              VueAny.h(Trigger, { value: 'a', ref: (el: any) => (refs.triggerA = el) }, () => 'A'),
              VueAny.h(Trigger, { value: 'b', ref: (el: any) => (refs.triggerB = el) }, () => 'B'),
            ]),
            VueAny.h(
              Content,
              { value: 'a', ref: (el: any) => (refs.contentA = el) },
              () => 'A panel'
            ),
            VueAny.h(
              Content,
              { value: 'b', ref: (el: any) => (refs.contentB = el) },
              () => 'B panel'
            ),
            VueAny.h(
              Content,
              { value: 'c', keepMounted: true, ref: (el: any) => (refs.contentC = el) },
              () => 'C panel'
            ),
          ]);
      },
    });

    try {
      app.mount(host);
      await flushVue();
      await flushVue();

      expect(refs.list?.$el.getAttribute('role')).toBe('tablist');
      expect(refs.list?.$el.getAttribute('aria-label')).toBe('Vue tabs');
      expect(refs.root?.getExposes().value.get()).toBe('a');
      expect(refs.triggerA?.getExposes().selected.get()).toBe(true);
      expect(refs.contentA?.getExposes().current.get()).toBe(true);
      const firstContentId = refs.contentA.$el.id;
      expect(firstContentId).not.toBe('');
      expect(refs.triggerA.$el.getAttribute('aria-controls')).toBe(firstContentId);
      expect(refs.triggerB.$el.hasAttribute('aria-controls')).toBe(false);
      expect(host.textContent).not.toContain('B panel');
      expect(host.textContent).toContain('C panel');
      expect(refs.triggerB?.$el.getAttribute('tabindex')).toBe('-1');

      refs.triggerA?.$el.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      await flushVue();

      expect(document.activeElement).toBe(refs.triggerB?.$el);
      expect(refs.root?.getExposes().value.get()).toBe('b');
      expect(refs.triggerA.$el.hasAttribute('aria-controls')).toBe(false);
      expect(refs.triggerB.$el.getAttribute('aria-controls')).toBe(refs.contentB.$el.id);

      refs.triggerA?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue();
      await flushVue();

      expect(refs.root?.getExposes().value.get()).toBe('a');
      expect(refs.triggerA?.getExposes().selected.get()).toBe(true);
      expect(refs.triggerB?.getExposes().selected.get()).toBe(false);
      expect(refs.contentA?.getExposes().current.get()).toBe(true);
      expect(refs.contentA.$el.id).toBe(firstContentId);
      expect(refs.triggerA.$el.getAttribute('aria-controls')).toBe(firstContentId);
      expect(refs.contentA.$el.getAttribute('aria-labelledby')).toBe(refs.triggerA.$el.id);
      expect(refs.triggerB.$el.hasAttribute('aria-controls')).toBe(false);
      expect(refs.contentB?.getExposes().current.get()).toBe(false);
      expect(host.textContent).not.toContain('B panel');

      refs.triggerB?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue();
      await flushVue();

      expect(host.textContent).toContain('B panel');
      expect(host.textContent).toContain('C panel');
    } finally {
      app.unmount();
      host.remove();
      await flushVue();
    }
  });
});
