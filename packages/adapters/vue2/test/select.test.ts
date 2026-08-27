import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  selectContent,
  selectItem,
  selectRoot,
  selectTrigger,
  selectValue,
} from '../../../prototypes/base/src/select';

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny } from './utils/vue2';

async function settleVue2(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Vue2Any.nextTick();
  await Promise.resolve();
  await Vue2Any.nextTick();
}

afterEach(() => vi.useRealTimers());

describe('adapter-vue2: base select compound protocol', () => {
  it('projects select ARIA, keyboard navigation, and committed value through Vue 2', async () => {
    vi.useFakeTimers();
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(selectRoot);
    const Trigger = adapt(selectTrigger);
    const Value = adapt(selectValue);
    const Content = adapt(selectContent);
    const Item = adapt(selectItem);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const App = Vue2Any.extend({
      render(h: any) {
        return h(Root, { attrs: { defaultOpen: true, defaultValue: 'alpha' }, ref: 'root' }, [
          h(Trigger, { ref: 'trigger' }, [
            h(Value, { attrs: { placeholder: 'Pick one' }, ref: 'value' }),
          ]),
          h(Content, { ref: 'content' }, [
            h(Item, { attrs: { value: 'alpha', textValue: 'Alpha' }, ref: 'alpha' }, ['Alpha']),
            h(Item, { attrs: { value: 'beta', textValue: 'Beta' }, ref: 'beta' }, ['Beta']),
          ]),
        ]);
      },
    });
    const vm = new App().$mount();
    host.appendChild(vm.$el);

    try {
      await settleVue2();
      await settleVue2();

      const refs = vm.$refs as Record<string, any>;
      expect(refs.trigger?.$el.getAttribute('role')).toBe('combobox');
      expect(refs.trigger?.$el.getAttribute('aria-haspopup')).toBe('listbox');
      expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('true');
      const contentEl = document.getElementById(refs.trigger?.$el.getAttribute('aria-controls'));
      expect(contentEl?.getAttribute('role')).toBe('listbox');
      expect(refs.alpha?.$el.getAttribute('role')).toBe('option');
      expect(refs.alpha?.$el.getAttribute('aria-selected')).toBe('true');
      expect(refs.beta?.$el.getAttribute('aria-selected')).toBe('false');
      expect(refs.value?.$el.textContent).toBe('Alpha');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await settleVue2();
      expect(document.activeElement).toBe(refs.beta?.$el);
      refs.beta?.$el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settleVue2();

      expect(refs.root?.getExposes().value.get()).toBe('beta');
      expect(refs.root?.getExposes().textValue.get()).toBe('Beta');
      expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('false');
      expect(refs.value?.$el.textContent).toBe('Beta');
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
