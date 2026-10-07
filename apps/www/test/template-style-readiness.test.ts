import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { VueAny, flushVue } from '../../../packages/adapters/vue/test/utils/vue';
import {
  Vue2Any,
  Vue2RuntimeAny,
  flushVue2,
} from '../../../packages/adapters/vue2/test/utils/vue2';
import { captureTemplateOwnership } from './fixtures/template-style/ownership';

// The ownership boundary is identical with and without a child style carrier.
// This suite also runs against the pinned pre-carrier adapter inputs.
describe('Template browser fixture initial ownership boundary', () => {
  it('wc retains its existing caller carrier alongside root feedback at the ready boundary', async () => {
    const proto = definePrototype({
      name: 'template-ready-wc',
      setup(def) {
        def.feedback.style.use(tw('p-1'));
        return (r) => r.el('section', [r.el('span', { style: tw('p-4') }, 'owned'), r.slot()]);
      },
    });
    AdaptToWebComponent(proto);
    const host = document.createElement('div');
    const root = document.createElement(proto.name);
    root.setAttribute('data-pui-style', 'p-8');
    const slot = document.createElement('b');
    slot.setAttribute('data-caller-slot', '');
    root.append(slot);
    host.append(root);
    document.body.append(host);
    try {
      // WC's existing feedback sink preserves caller-owned tokens; the three
      // framework root renderers have their own existing projection behavior.
      expect(root.getAttribute('data-pui-style')).toBe('p-8 p-1');
      const snapshot = await captureTemplateOwnership([{ host }], async () => {
        await Promise.resolve();
      });
      expect(snapshot.originalRoots).toEqual([root]);
      expect(snapshot.originalSlots).toEqual([slot]);
      expect(snapshot.originalRootCarriers).toEqual(['p-8 p-1']);
    } finally {
      host.remove();
    }
  });
  it.each(['vue', 'vue2'])(
    '%s snapshots the committed root and slot only after settlement',
    async (runtime) => {
      const host = document.createElement('div');
      document.body.append(host);
      const proto = definePrototype({
        name: `template-ready-${runtime}`,
        setup(def) {
          def.feedback.style.use(tw('p-1'));
          return (r) => r.el('section', [r.el('span', { style: tw('p-4') }, 'owned'), r.slot()]);
        },
      });
      let unmount: () => void;
      if (runtime === 'vue') {
        const Component = createVueAdapter(VueAny)(proto);
        const app = VueAny.createApp({
          render: () =>
            VueAny.h(Component, {}, () => [VueAny.h('b', { 'data-caller-slot': '' }, 'caller')]),
        });
        app.mount(host);
        unmount = () => app.unmount();
      } else {
        const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
        const App = Vue2Any.extend({
          render(h: any) {
            return h(Component, {}, [h('b', { attrs: { 'data-caller-slot': '' } }, 'caller')]);
          },
        });
        const vm = new App().$mount();
        host.append(vm.$el);
        unmount = () => vm.$destroy();
      }
      try {
        // This is the transient state the old fixture accidentally retained.
        expect(host.querySelector('[data-caller-slot]')).toBeNull();
        expect(host.querySelector('[data-pui-root]')!.getAttribute('data-pui-style')).toBeNull();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let published = false;
        const capture = captureTemplateOwnership([{ host }], async () => {
          await gate;
          await flushVue();
          await flushVue2();
        }).then((snapshot) => {
          published = true;
          return snapshot;
        });
        await Promise.resolve();
        expect(published).toBe(false);
        release();
        const snapshot = await capture;
        expect(snapshot.originalRoots[0]).toBe(host.querySelector('[data-pui-root]'));
        expect(snapshot.originalSlots[0]).not.toBeNull();
        expect(snapshot.originalSlots[0]).toBe(host.querySelector('[data-caller-slot]'));
        expect(snapshot.originalRootCarriers).toEqual(['p-1']);
      } finally {
        unmount();
        host.remove();
      }
    }
  );
});
