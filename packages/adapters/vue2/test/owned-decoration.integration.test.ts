import { expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { createVue2Adapter } from '../src/adapt';
import { Vue2Any as Vue, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
const settle = async (action: () => void) => {
  action();
  await flushVue2();
  await new Promise((r) => setTimeout(r, 0));
  await flushVue2();
};
it('Vue2 real KeepAlive retains logical targets and rebinds complete physical view', async () => {
  let setups = 0,
    renders = 0;
  const proto = definePrototype({
    name: 'vue2-owned-leaf',
    setup(def) {
      setups++;
      const target = def.feedback.style.declareDecoration();
      const active = def.state.bool('active', false);
      def.feedback.style.to(target).use(tw('bg-black opacity-50'));
      def.rule({
        when: (w) => w.state(active).eq(true),
        intent: (i) => i.feedback.style.to(target).use(tw('bg-white opacity-100')),
      });
      def.event.on('key.down', (_run, e) => {
        if (e.key === 'F2') active.set(!active.get());
      });
      return (r) => {
        renders++;
        return [r.decoration(target), r.slot()];
      };
    },
  });
  const Component = createVue2Adapter(Vue2RuntimeAny)(proto, { autoUpdateOnPropsChange: false });
  const App = Vue.extend({
    data: () => ({ visible: true }),
    render(h: any) {
      return h('div', [
        h('keep-alive', [
          this.visible
            ? h(Component, { key: 'owner' }, [
                h('input', { domProps: { value: 'retain selection' } }),
              ])
            : null,
        ]),
      ]);
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const vm = new App().$mount();
  host.append(vm.$el);
  try {
    await settle(() => {});
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
      vm.visible = false;
    });
    const hidden = leaf.getAttribute('data-pui-style');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
    await flushVue2();
    expect(leaf.getAttribute('data-pui-style')).toBe(hidden);
    await settle(() => {
      vm.visible = true;
    });
    const rebound = host.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
    expect(rebound.getAttribute('data-pui-style')).toContain('bg-white');
    expect(setups).toBe(1);
    expect(host.querySelector('input')).toBe(input);
    await settle(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
    );
    expect(rebound.getAttribute('data-pui-style')).toContain('bg-black');
    expect(rebound.hasAttribute('inert')).toBe(true);
    expect(rebound.tabIndex).toBe(-1);
  } finally {
    await settle(() => vm.$destroy());
    host.remove();
  }
});

it('vue2 real same-document portal retains Rule paint through reopen', async () => {
  const { asOverlay } = await import('@proto.ui/hooks');
  let setups = 0,
    renders = 0,
    actions!: { open: () => void; close: () => void };
  const proto = definePrototype({
    name: 'vue2-portal-owned-leaf',
    setup(def) {
      setups++;
      const overlay = asOverlay();
      overlay.configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
      def.expose('portalActions', {
        open: () => overlay.openOverlay(),
        close: () => overlay.close(),
      });
      const target = def.feedback.style.declareDecoration(),
        active = def.state.bool('active', false);
      def.feedback.style.to(target).use(tw('bg-black'));
      def.rule({
        when: (w) => w.state(active).eq(true),
        intent: (i) => i.feedback.style.to(target).use(tw('bg-white')),
      });
      def.event.on('key.down', (_run, e) => {
        if (e.key === 'F2') active.set(!active.get());
      });
      return (r) => {
        renders++;
        return [r.decoration(target), r.slot()];
      };
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const Component = createVue2Adapter(Vue2RuntimeAny)(proto, { autoUpdateOnPropsChange: false });
  const App = Vue.extend({
    render(h: any) {
      return h('div', [
        h(Component, { ref: 'portal' }, [
          h('input', {
            attrs: { 'data-portal-probe': 'vue2' },
            domProps: { value: 'retain caller' },
          }),
        ]),
      ]);
    },
  });
  const vm = new App().$mount();
  container.append(vm.$el);
  try {
    await settle(() => {});

    const input = document.querySelector<HTMLInputElement>('input[data-portal-probe="vue2"]')!;
    const host = input.parentElement!,
      leaf = host.querySelector<HTMLElement>('[data-pui-owned-decoration]')!;
    expect(container.contains(host)).toBe(false);
    expect(host.isConnected).toBe(true);
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-black');
    input.focus();
    input.setSelectionRange(1, 4, 'backward');
    const before = renders;
    await settle(() =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
    );
    expect(leaf.getAttribute('data-pui-style')).toBe('bg-white');
    expect(renders).toBe(before);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
    actions = vm.$refs.portal.getExposes().portalActions;
    for (let i = 0; i < 3; i++) {
      await settle(actions.close);
      await settle(actions.open);
    }
    const current = document.querySelector<HTMLInputElement>('input[data-portal-probe="vue2"]')!;
    expect(setups).toBe(1);
    expect(current.value).toBe('retain caller');
    expect(
      current
        .parentElement!.querySelector('[data-pui-owned-decoration]')!
        .getAttribute('data-pui-style')
    ).toBe('bg-white');
  } finally {
    await settle(() => vm.$destroy());
    container.remove();
  }
});
