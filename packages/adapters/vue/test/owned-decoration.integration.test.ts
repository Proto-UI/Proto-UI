import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { createVueAdapter } from '../src/adapt';
import { VueAny as Vue, flushVue } from './utils/vue';
const settle = async (action: () => void) => {
  action();
  await flushVue();
  await new Promise((r) => setTimeout(r, 0));
  await flushVue();
};
describe('draft Vue owned decoration view leases', () => {
  for (const context of [true, false])
    it(`keeps owner/paint across real KeepAlive (ownerContext=${context})`, async () => {
      let setups = 0,
        renders = 0;
      const proto = definePrototype({
        name: 'vue-owned-leaf-' + context,
        setup(def) {
          setups++;
          const leaf = def.feedback.style.declareDecoration();
          const active = def.state.bool('active', false);
          def.feedback.style.to(leaf).use(tw('bg-black opacity-50'));
          def.rule({
            when: (w) => w.state(active).eq(true),
            intent: (i) => i.feedback.style.to(leaf).use(tw('bg-white opacity-100')),
          });
          def.event.on('key.down', (_run, e) => {
            if (e.key === 'F2') active.set(!active.get());
          });
          return (r) => {
            renders++;
            return [r.decoration(leaf), r.slot()];
          };
        },
      });
      const runtime = context ? Vue : { ...Vue, provide: undefined, inject: undefined };
      const Component = createVueAdapter(runtime)(proto, { autoUpdateOnPropsChange: false });
      const visible = Vue.ref(true);
      const host = document.createElement('div');
      document.body.append(host);
      const app = Vue.createApp({
        render: () =>
          Vue.h(Vue.KeepAlive, null, {
            default: () =>
              visible.value
                ? Vue.h(Component, { key: 'owner' }, () => [
                    Vue.h('input', { value: 'retain selection' }),
                  ])
                : null,
          }),
      });
      try {
        await settle(() => app.mount(host));
        const leaf = host.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
        const input = host.querySelector('input')!;
        expect(leaf).not.toBeNull();
        expect(leaf.getAttribute('data-pui-style')).toContain('bg-black');
        input.focus();
        input.setSelectionRange(2, 7, 'backward');
        const before = renders;
        await settle(() =>
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
        );
        expect(leaf.getAttribute('data-pui-style')).toContain('bg-white');
        expect(renders).toBe(before);
        expect(document.activeElement).toBe(input);
        expect([input.selectionStart, input.selectionEnd]).toEqual([2, 7]);
        await settle(() => {
          visible.value = false;
        });
        const hiddenTokens = leaf.getAttribute('data-pui-style');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
        await flushVue();
        expect(leaf.getAttribute('data-pui-style')).toBe(hiddenTokens);
        await settle(() => {
          visible.value = true;
        });
        const rebound = host.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
        expect(rebound.getAttribute('data-pui-style')).toContain('bg-white');
        expect(setups).toBe(1);
        expect(host.querySelector('input')).toBe(input);
        await settle(() =>
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
        );
        expect(rebound.getAttribute('data-pui-style')).toContain('bg-black');
        expect(rebound.getAttribute('aria-hidden')).toBe('true');
        expect(rebound.hasAttribute('inert')).toBe(true);
        expect(rebound.tabIndex).toBe(-1);
      } finally {
        await settle(() => app.unmount());
        host.remove();
      }
    });
});
