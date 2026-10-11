import { afterEach, describe, expect, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as bootstrap from '../../../prototypes/bootstrap-2-3-2/src/select';
import * as glass from '../../../prototypes/liquid-glass/src/select';
import { createVueAdapter } from '../src/adapt';
import { flushVue, VueAny } from './utils/vue';

async function settleVue(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await flushVue();
  await flushVue();
}

afterEach(() => vi.useRealTimers());

for (const [family, { selectContent, selectItem, selectRoot, selectTrigger, selectValue }] of [
  ['base', base],
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', glass],
] as const) {
  describe(`adapter-vue: ${family} select compound protocol`, () => {
    it('projects select-only ARIA and keyboard selection through Vue', async () => {
      vi.useFakeTimers();
      const adapter = createVueAdapter(VueAny);
      const Root = adapter(selectRoot);
      const Trigger = adapter(selectTrigger);
      const Value = adapter(selectValue);
      const Content = adapter(selectContent);
      const Item = adapter(selectItem);
      const refs: Record<string, any> = {};
      const host = document.createElement('div');
      document.body.appendChild(host);

      const app = VueAny.createApp({
        setup() {
          return () =>
            VueAny.h(
              Root,
              {
                defaultOpen: true,
                defaultValue: 'alpha',
                ref: (el: any) => (refs.root = el),
              },
              () => [
                VueAny.h(Trigger, { ref: (el: any) => (refs.trigger = el) }, () => [
                  VueAny.h(Value, {
                    placeholder: 'Pick one',
                    ref: (el: any) => (refs.value = el),
                  }),
                ]),
                VueAny.h(Content, { ref: (el: any) => (refs.content = el) }, () => [
                  VueAny.h(
                    Item,
                    {
                      value: 'alpha',
                      textValue: 'Alpha',
                      ref: (el: any) => (refs.alpha = el),
                    },
                    () => 'Alpha'
                  ),
                  VueAny.h(
                    Item,
                    {
                      value: 'beta',
                      textValue: 'Beta',
                      ref: (el: any) => (refs.beta = el),
                    },
                    () => 'Beta'
                  ),
                ]),
              ]
            );
        },
      });

      app.mount(host);
      await settleVue();

      try {
        expect(refs.trigger?.$el.getAttribute('role')).toBe('combobox');
        expect(refs.trigger?.$el.getAttribute('aria-haspopup')).toBe('listbox');
        expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('true');
        const contentEl = document.getElementById(refs.trigger?.$el.getAttribute('aria-controls'));
        expect(contentEl?.getAttribute('role')).toBe('listbox');
        expect(contentEl?.getAttribute('id')).toBe(refs.trigger?.$el.getAttribute('aria-controls'));
        expect(refs.alpha?.$el.getAttribute('role')).toBe('option');
        expect(refs.alpha?.$el.getAttribute('aria-selected')).toBe('true');
        expect(refs.beta?.$el.getAttribute('aria-selected')).toBe('false');
        expect(refs.value?.$el.textContent).toBe('Alpha');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        await settleVue();
        expect(document.activeElement).toBe(refs.beta?.$el);
        refs.beta?.$el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await settleVue();
        expect(refs.root?.getExposes().value.get()).toBe('beta');
        expect(refs.root?.getExposes().textValue.get()).toBe('Beta');
        expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('false');
        expect(refs.value?.$el.textContent).toBe('Beta');
      } finally {
        app.unmount();
        host.remove();
      }
    });
  });
}
