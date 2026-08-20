import { describe, expect, it } from 'vitest';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../../../prototypes/base/src/tabs';

import { VueAny, flushVue } from './utils/vue';
import { createVueAdapter } from '../src/adapt';

describe('adapter-vue: base tabs compound protocol', () => {
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

    app.mount(host);
    await flushVue();
    await flushVue();

    expect(refs.list?.$el.getAttribute('role')).toBe('tablist');
    expect(refs.list?.$el.getAttribute('aria-label')).toBe('Vue tabs');
    expect(refs.root?.getExposes().value.get()).toBe('a');
    expect(refs.triggerA?.getExposes().selected.get()).toBe(true);
    expect(refs.contentA?.getExposes().current.get()).toBe(true);
    expect(host.textContent).not.toContain('B panel');
    expect(host.textContent).toContain('C panel');
    expect(refs.triggerB?.$el.getAttribute('tabindex')).toBe('-1');

    refs.triggerA?.$el.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flushVue();

    expect(document.activeElement).toBe(refs.triggerB?.$el);
    expect(refs.root?.getExposes().value.get()).toBe('b');

    refs.triggerA?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushVue();
    await flushVue();

    expect(refs.root?.getExposes().value.get()).toBe('a');
    expect(refs.triggerA?.getExposes().selected.get()).toBe(true);
    expect(refs.triggerB?.getExposes().selected.get()).toBe(false);
    expect(refs.contentA?.getExposes().current.get()).toBe(true);
    expect(refs.contentB?.getExposes().current.get()).toBe(false);
    expect(host.textContent).not.toContain('B panel');

    refs.triggerB?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushVue();
    await flushVue();

    expect(host.textContent).toContain('B panel');
    expect(host.textContent).toContain('C panel');

    app.unmount();
    host.remove();
  });
});
