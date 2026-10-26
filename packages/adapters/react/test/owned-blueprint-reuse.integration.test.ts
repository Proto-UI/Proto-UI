import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { asOverlay } from '@proto.ui/hooks';
import { definePrototype, tw } from '@proto.ui/core';
import * as adapterBase from '@proto.ui/adapter-base';
import { createReactAdapter } from '../src';
import { createVueAdapter } from '../../vue/src';
import { VueAny as Vue, flushVue } from '../../vue/test/utils/vue';
import { createVue2Adapter } from '../../vue2/src';
import { Vue2Any as Vue2, Vue2RuntimeAny, flushVue2 } from '../../vue2/test/utils/vue2';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let serial = 0;
function fixture(options: { portal?: boolean; updateOnMount?: boolean } = {}) {
  const state = {
    change: '',
    renders: 0,
    updates: 0,
    onUpdated: undefined as (() => void) | undefined,
  };
  const proto = definePrototype<{ active: boolean }>({
    name: `exact-owned-blueprint-${++serial}`,
    setup(def) {
      def.props.define({ active: { type: 'boolean', default: false } });
      if (options.portal) {
        const overlay = asOverlay();
        overlay.configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
        def.expose('portalActions', {
          open: () => overlay.openOverlay(),
          close: () => overlay.close(),
        });
      }
      if (options.updateOnMount) def.lifecycle.onMounted((run) => run.update());
      const first = def.feedback.style.declareDecoration();
      const second = def.feedback.style.declareDecoration();
      def.feedback.style.to(first).use(tw('bg-black'));
      def.feedback.style.to(second).use(tw('opacity-50'));
      def.rule({
        when: (w) => w.prop('active').eq(true),
        intent: (i) => i.feedback.style.to(first).use(tw('bg-white')),
      });
      def.lifecycle.onUpdated(() => {
        state.updates++;
        state.onUpdated?.();
      });
      return (r) => {
        state.renders++;
        const leaves =
          state.change === 'targets'
            ? [r.decoration(second), r.decoration(first)]
            : [r.decoration(first), r.decoration(second)];
        const slot = r.slot();
        const children = [
          ...leaves,
          r.el(
            'span',
            { style: tw(state.change === 'style' ? 'opacity-25' : 'opacity-75') },
            state.change === 'text' ? 'changed' : 'fixed'
          ),
          r.svg.root({ viewBox: state.change === 'svg' ? '0 0 12 12' : '0 0 24 24' }, [
            r.svg.path({ d: 'M0 0L1 1' }),
          ]),
        ];
        return r.el(
          state.change === 'wrapper' ? 'article' : 'section',
          state.change === 'slot' ? [slot, ...children] : [...children, slot]
        );
      };
    },
  });
  return { proto, state };
}

type Mounted = {
  host: HTMLElement;
  errors: unknown[];
  update(): void;
  exposes(): any;
  props(active: boolean, label: string): Promise<void>;
  flush(action?: () => void): Promise<void>;
  close(): Promise<void>;
};
const drivers: Record<
  string,
  (proto: ReturnType<typeof fixture>['proto'], pendingUpdate?: boolean) => Promise<Mounted>
> = {
  async React(proto, pendingUpdate = false) {
    const Component = createReactAdapter({ ...React, createPortal })(proto);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host),
      ref = React.createRef<any>();
    function EarlyUpdate() {
      React.useLayoutEffect(() => {
        if (pendingUpdate) ref.current.update();
      }, []);
      return null;
    }
    const flush = async (action?: () => void) => {
      await act(async () => {
        action?.();
      });
    };
    const props = async (active: boolean, label: string) =>
      flush(() =>
        root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              Component,
              { active, ref },
              React.createElement('input', { key: 'input', defaultValue: 'retain selection' }),
              React.createElement('button', { key: 'label' }, label)
            ),
            React.createElement(EarlyUpdate)
          )
        )
      );
    await props(false, 'A');
    return {
      host,
      errors: [],
      update: () => ref.current.update(),
      exposes: () => ref.current.getExposes(),
      props,
      flush,
      close: async () => {
        await flush(() => root.unmount());
        host.remove();
      },
    };
  },
  async Vue(proto, pendingUpdate = false) {
    const Component = createVueAdapter(Vue)(proto),
      active = Vue.ref(false),
      label = Vue.ref('A');
    const host = document.createElement('div');
    document.body.append(host);
    const errors: unknown[] = [];
    let handle: any;
    const app = Vue.createApp({
      mounted() {
        if (pendingUpdate) handle.update();
      },
      render: () =>
        Vue.h(
          Component,
          {
            active: active.value,
            ref: (value: any) => {
              handle = value;
            },
          },
          () => [
            Vue.h('input', { key: 'input', value: 'retain selection' }),
            Vue.h('button', { key: 'label' }, label.value),
          ]
        ),
    });
    app.config.errorHandler = (error: unknown) => errors.push(error);
    const flush = async (action?: () => void) => {
      action?.();
      await flushVue();
      await flushVue();
    };
    app.mount(host);
    await flush();
    return {
      host,
      errors,
      update: () => handle.update(),
      exposes: () => handle.getExposes(),
      flush,
      props: async (next: boolean, text: string) =>
        flush(() => {
          active.value = next;
          label.value = text;
        }),
      close: async () => {
        app.unmount();
        host.remove();
      },
    };
  },
  async Vue2(proto, pendingUpdate = false) {
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const host = document.createElement('div');
    document.body.append(host);
    const errors: unknown[] = [],
      oldHandler = Vue2.config.errorHandler;
    Vue2.config.errorHandler = (error: unknown) => errors.push(error);
    const App = Vue2.extend({
      data: () => ({ active: false, label: 'A' }),
      mounted(this: any) {
        if (pendingUpdate) this.$refs.owned.update();
      },
      render(this: any, h: any) {
        return h(Component, { attrs: { active: this.active }, ref: 'owned' }, [
          h('input', { key: 'input', domProps: { value: 'retain selection' } }),
          h('button', { key: 'label' }, this.label),
        ]);
      },
    });
    const vm = new App().$mount();
    host.append(vm.$el);
    const flush = async (action?: () => void) => {
      action?.();
      await flushVue2();
      await flushVue2();
    };
    await flush();
    return {
      host,
      errors,
      update: () => vm.$refs.owned.update(),
      exposes: () => vm.$refs.owned.getExposes(),
      flush,
      props: async (active: boolean, label: string) =>
        flush(() => {
          vm.active = active;
          vm.label = label;
        }),
      close: async () => {
        vm.$destroy();
        host.remove();
        Vue2.config.errorHandler = oldHandler;
      },
    };
  },
};

for (const [name, mount] of Object.entries(drivers))
  describe(`${name} exact owned blueprint`, () => {
    it('retains one physical stage across default props, fresh caller slots, withdrawal and explicit updates', async () => {
      const { proto, state } = fixture();
      const createStage = vi.spyOn(adapterBase, 'createWebOwnedDecorationStage');
      const mounted = await mount(proto);
      try {
        const wrapper = mounted.host.querySelector('section')!;
        const leaves = [...mounted.host.querySelectorAll('[data-pui-owned-decoration]')];
        const input = mounted.host.querySelector('input')!;
        input.focus();
        input.setSelectionRange(2, 7, 'backward');
        const before = state.renders;
        await mounted.props(true, 'B');
        expect(state.renders).toBeGreaterThan(before);
        expect(mounted.host.querySelector('button')?.textContent).toBe('B');
        expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-white');
        expect(leaves[1].getAttribute('data-pui-style')).toBe('opacity-50');
        await mounted.props(false, 'C');
        expect(leaves[0].getAttribute('data-pui-style')).toBe('bg-black');
        const acknowledgments = state.updates;
        await mounted.flush(() => mounted.update());
        expect(state.updates).toBe(acknowledgments + 1);
        await mounted.flush(() => {
          mounted.update();
          mounted.update();
        });
        expect(mounted.host.querySelector('section')).toBe(wrapper);
        const currentLeaves = [...mounted.host.querySelectorAll('[data-pui-owned-decoration]')];
        expect(currentLeaves).toHaveLength(leaves.length);
        currentLeaves.forEach((leaf, index) => expect(leaf).toBe(leaves[index]));
        expect(mounted.host.querySelector('input')).toBe(input);
        expect(document.activeElement).toBe(input);
        expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
          2,
          7,
          'backward',
        ]);
        expect(input.value).toBe('retain selection');
        expect(mounted.errors).toEqual([]);
        expect(createStage).toHaveBeenCalledTimes(1);
      } finally {
        await mounted.close();
        createStage.mockRestore();
      }
    });

    it('keeps the initial stage when runtime ignores a pre-mount update request', async () => {
      const { proto, state } = fixture();
      const createStage = vi.spyOn(adapterBase, 'createWebOwnedDecorationStage');
      const mounted = await mount(proto, true);
      try {
        expect(
          mounted.host.querySelector('[data-pui-owned-decoration]')?.getAttribute('data-pui-style')
        ).toBe('bg-black');
        expect(state.updates).toBe(0);
        expect(createStage).toHaveBeenCalledTimes(1);
        await mounted.props(true, 'B');
        expect(mounted.errors).toEqual([]);
      } finally {
        await mounted.close();
        createStage.mockRestore();
      }
    });

    it('leaves ordinary no-decoration templates on their existing dynamic update path', async () => {
      let text = 'ordinary-before';
      const proto = definePrototype<{ active: boolean }>({
        name: `ordinary-blueprint-control-${++serial}`,
        setup(def) {
          def.props.define({ active: { type: 'boolean', default: false } });
          return (r) => r.el('section', [text, r.slot()]);
        },
      });
      const mounted = await mount(proto);
      try {
        text = 'ordinary-after';
        await mounted.flush(() => mounted.update());
        expect(mounted.host.textContent).toContain('ordinary-after');
        await mounted.props(true, 'B');
        expect(mounted.host.querySelector('button')?.textContent).toBe('B');
        expect(mounted.errors).toEqual([]);
      } finally {
        await mounted.close();
      }
    });

    it('establishes reusable physical state before a reentrant acknowledgment update', async () => {
      const { proto, state } = fixture({ updateOnMount: true });
      const createStage = vi.spyOn(adapterBase, 'createWebOwnedDecorationStage');
      const mounted = await mount(proto);
      try {
        const leaf = mounted.host.querySelector('[data-pui-owned-decoration]');
        let reentered = false;
        state.onUpdated = () => {
          if (reentered) return;
          reentered = true;
          mounted.update();
        };
        const before = state.updates;
        await mounted.flush(() => mounted.update());
        expect(reentered).toBe(true);
        expect(state.updates).toBe(before + 2);
        expect(mounted.host.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
        expect(createStage).toHaveBeenCalledTimes(1);
        expect(mounted.errors).toEqual([]);
      } finally {
        await mounted.close();
        createStage.mockRestore();
      }
    });

    it('keeps default-props portal updates in the live epoch and binds a new leaf after reopen', async () => {
      const { proto } = fixture({ portal: true }),
        mounted = await mount(proto);
      try {
        const wrapper = document.querySelector('section')!;
        const leaf = wrapper.querySelector('[data-pui-owned-decoration]')!;
        const input = wrapper.querySelector('input')!;
        expect(leaf).not.toBeNull();
        input.focus();
        input.setSelectionRange(1, 4, 'backward');
        await mounted.props(true, 'B');
        expect(document.querySelector('section')).toBe(wrapper);
        expect(wrapper.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
        expect(leaf.getAttribute('data-pui-style')).toBe('bg-white');
        expect(wrapper.querySelector('button')?.textContent).toBe('B');
        expect(document.activeElement).toBe(input);
        const actions = mounted.exposes().portalActions;
        await mounted.flush(actions.close);
        await mounted.flush(actions.open);
        const replacement = document
          .querySelector('section')
          ?.querySelector('[data-pui-owned-decoration]');
        expect(replacement).not.toBe(leaf);
        expect(replacement?.getAttribute('data-pui-style')).toBe('bg-white');
        await mounted.props(false, 'C');
        expect(replacement?.getAttribute('data-pui-style')).toBe('bg-black');
        expect(mounted.errors).toEqual([]);
      } finally {
        await mounted.close();
      }
    });

    for (const change of ['wrapper', 'text', 'style', 'svg', 'slot', 'targets'])
      it(`rejects changed ${change} before replacing the committed view`, async () => {
        const { proto, state } = fixture(),
          mounted = await mount(proto);
        try {
          const wrapper = mounted.host.querySelector('section'),
            input = mounted.host.querySelector('input');
          const leaves = [...mounted.host.querySelectorAll('[data-pui-owned-decoration]')];
          state.change = change;
          expect(() => mounted.update()).toThrow(/structural rebind unsupported/);
          expect(mounted.host.querySelector('section')).toBe(wrapper);
          expect(mounted.host.querySelector('input')).toBe(input);
          const currentLeaves = [...mounted.host.querySelectorAll('[data-pui-owned-decoration]')];
          expect(currentLeaves).toHaveLength(leaves.length);
          currentLeaves.forEach((leaf, index) => expect(leaf).toBe(leaves[index]));
          state.change = '';
          await mounted.flush(() => mounted.update());
          expect(mounted.errors).toEqual([]);
        } finally {
          await mounted.close();
        }
      });

    it('rejects a suspended replacement portal material epoch', async () => {
      const { proto } = fixture({ portal: true }),
        mounted = await mount(proto);
      let material: ReturnType<typeof adapterBase.beginWebPortalMaterialEpoch> | undefined;
      try {
        const wrapper = document.querySelector('section')!;
        const host = wrapper.parentElement!;
        const leaf = wrapper.querySelector('[data-pui-owned-decoration]');
        material = adapterBase.beginWebPortalMaterialEpoch(host);
        material.suspend();
        expect(() => mounted.update()).toThrow(/portal|reus/);
        expect(wrapper.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
      } finally {
        material?.release();
        await mounted.close();
      }
    });

    it('rejects an equal blueprint after foreign-document adoption', async () => {
      const { proto } = fixture(),
        mounted = await mount(proto);
      const root = mounted.host.querySelector('section')!.parentElement!;
      const parent = root.parentElement!;
      try {
        const foreign = document.implementation.createHTMLDocument('foreign');
        foreign.body.append(foreign.adoptNode(root));
        expect(() => mounted.update()).toThrow(/stale|document|physical/);
      } finally {
        // happy-dom's adoptNode makes ownerDocument non-configurable, so a
        // second adoption itself throws. Restore the parent only for teardown.
        parent.append(root);
        await mounted.close();
      }
    });

    it('does not reuse an author-reparented physical leaf', async () => {
      const { proto } = fixture(),
        mounted = await mount(proto);
      try {
        const leaf = mounted.host.querySelector('[data-pui-owned-decoration]')!;
        const wrapper = mounted.host.querySelector('section')!;
        wrapper.parentElement!.append(leaf);
        expect(() => mounted.update()).toThrow(/physical|scope|reus/);
        expect(leaf.parentElement).toBe(wrapper.parentElement);
      } finally {
        await mounted.close();
      }
    });
  });
