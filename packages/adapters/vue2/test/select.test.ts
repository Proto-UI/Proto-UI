import { afterEach, describe, expect, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as bootstrap from '../../../prototypes/bootstrap-2-3-2/src/select';
import * as glass from '../../../prototypes/liquid-glass/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';

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

for (const [family, projection] of [
  ['base', base],
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', glass],
] as const) {
  const {
    selectContent,
    selectSurface,
    selectViewport,
    selectItem,
    selectItemText,
    selectRoot,
    selectTrigger,
    selectValue,
  } = projection;
  describe(`adapter-vue2: ${family} select compound protocol`, () => {
    it('projects select ARIA, keyboard navigation, and committed value through Vue 2', async () => {
      vi.useFakeTimers();
      const adapt = createVue2Adapter(Vue2RuntimeAny);
      const Root = adapt(selectRoot);
      const Trigger = adapt(selectTrigger);
      const Value = adapt(selectValue);
      const Content = adapt(selectContent);
      const Surface = adapt(selectSurface);
      const Viewport = adapt(selectViewport);
      const Item = adapt(selectItem);
      const ItemText = adapt(selectItemText);
      const host = document.createElement('div');
      document.body.appendChild(host);

      const App = Vue2Any.extend({
        render(h: any) {
          return h(Root, { attrs: { defaultOpen: true, defaultValue: 'alpha' }, ref: 'root' }, [
            h(Trigger, { ref: 'trigger' }, [
              h(Value, { attrs: { placeholder: 'Pick one' }, ref: 'value' }),
            ]),
            h(Content, { ref: 'content' }, [
              h(Surface, { ref: 'surface' }, [
                h(Viewport, { ref: 'viewport' }, [
                  h(Item, { attrs: { value: 'alpha', textValue: 'Alpha' }, ref: 'alpha' }, [
                    h(ItemText, ['Alpha']),
                  ]),
                  h(Item, { attrs: { value: 'beta', textValue: 'Beta' }, ref: 'beta' }, [
                    h(ItemText, ['Beta']),
                  ]),
                ]),
              ]),
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
        expect(contentEl?.contains(refs.surface?.$el)).toBe(true);
        expect(refs.surface?.$el.contains(refs.viewport?.$el)).toBe(true);
        expect(refs.viewport?.$el.contains(refs.alpha?.$el)).toBe(true);
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

        // The popup can become visible before its deferred focus-entry task.
        // A real Tab from the still-focused Trigger must dismiss immediately.
        refs.trigger.$el.focus();
        refs.trigger.$el.click();
        await Vue2Any.nextTick();
        await Promise.resolve();
        expect(refs.root.getExposes().open.get()).toBe(true);
        expect(document.activeElement).toBe(refs.trigger.$el);
        const tab = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });
        refs.trigger.$el.dispatchEvent(tab);
        await Vue2Any.nextTick();
        await Promise.resolve();
        expect(refs.root.getExposes().open.get()).toBe(false);
        expect(refs.trigger.$el.getAttribute('aria-expanded')).toBe('false');
        expect(tab.defaultPrevented).toBe(false);
        await settleVue2();
        expect(refs.root.getExposes().value.get()).toBe('beta');
        expect(document.activeElement).toBe(refs.trigger.$el);
      } finally {
        vm.$destroy();
        host.remove();
      }
    });
  });
}

it('returns Shadcn Trigger focus when Escape synchronously retires the Content view', async () => {
  // T-BASE-SELECT-CONTENT-0001-CASE-DISMISS
  // Real Vue 2 and public lifecycle diagnostics; synthetic DOM input, not native paint evidence.
  vi.useFakeTimers();
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const Root = adapt(shadcn.selectRoot);
  const Trigger = adapt(shadcn.selectTrigger);
  const Value = adapt(shadcn.selectValue);
  let dispatchingEscape = false;
  let unmountedDuringEscape = false;
  const Content = adapt(shadcn.selectContent, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (dispatchingEscape && event.type === 'unmount.done') unmountedDuringEscape = true;
      },
    },
  });
  const Item = adapt(shadcn.selectItem);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const App = Vue2Any.extend({
    render(h: any) {
      return h(Root, { attrs: { defaultOpen: true, defaultValue: 'alpha' }, ref: 'root' }, [
        h(Trigger, { ref: 'trigger' }, [h(Value, { ref: 'value' })]),
        h(
          Content,
          { attrs: { position: 'popper', enterDuration: 0, leaveDuration: 0 }, ref: 'content' },
          [
            h(Item, { attrs: { value: 'alpha', textValue: 'Alpha' }, ref: 'alpha' }, ['Alpha']),
            h(Item, { attrs: { value: 'beta', textValue: 'Beta' }, ref: 'beta' }, ['Beta']),
          ]
        ),
      ]);
    },
  });
  const vm = new App().$mount();
  host.appendChild(vm.$el);

  try {
    await settleVue2();
    await settleVue2();
    const refs = vm.$refs as Record<string, any>;
    const trigger = refs.trigger.$el;
    const content = refs.content.$el;
    expect(refs.root.getExposes().open.get()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await settleVue2();
    expect(document.activeElement).toBe(refs.beta.$el);

    dispatchingEscape = true;
    try {
      refs.beta.$el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    } finally {
      dispatchingEscape = false;
    }
    await settleVue2();

    expect(unmountedDuringEscape).toBe(true);
    expect(refs.root.getExposes().open.get()).toBe(false);
    expect(refs.root.getExposes().value.get()).toBe('alpha');
    expect(trigger.isConnected).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(content.isConnected).toBe(true);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  } finally {
    vm.$destroy();
    host.remove();
  }
});
