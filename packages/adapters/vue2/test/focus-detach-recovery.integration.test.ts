import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { createVue2Adapter } from '../src';
import * as tree from '../src/platform/instance-tree';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';

// Real KeepAlive deactivation and activation. Only the readiness consumer or
// user lifecycle callback throws; no adapter or session lifecycle is mocked.
it.each(['release', 'reentrant-release', 'unmounted'] as const)(
  'reattaches the same Vue2 KeepAlive host after %s failure',
  async (mode) => {
    let setups = 0,
      mounts = 0;
    let armed = true;
    const failure = new Error('Vue2 detach failure');
    const errors: unknown[] = [];
    const state = Vue2Any.observable({ active: true });
    const proto = definePrototype({
      name: `vue2-detach-recovery-${mode}`,
      setup(def) {
        setups++;
        const focus = asFocusable();
        def.expose.method('focus', () => focus.focusSelf());
        def.expose.state('focused', focus.focused);
        def.lifecycle.onMounted(() => {
          mounts++;
        });
        def.lifecycle.onUnmounted(() => {
          if (mode === 'unmounted' && armed) {
            armed = false;
            throw failure;
          }
        });
        return (r) => r.el('span', 'Retained content');
      },
    });
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const Root = Vue2Any.extend({
      render(h: any) {
        return h('keep-alive', [
          state.active ? h(Component, { key: 'owner', ref: 'owner' }) : null,
        ]);
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const previousErrorHandler = Vue2Any.config.errorHandler;
    Vue2Any.config.errorHandler = (error: unknown) => errors.push(error);
    const app = new Root().$mount();
    host.append(app.$el);
    await flushVue2();
    await flushVue2();
    const vm = app.$refs.owner;
    const root = vm.$el as HTMLElement;
    const token = tree.getLogicalEventRouteSurfaceForTarget(root)!;
    const off = tree.subscribeFocusSurfaceReady(
      token,
      () => {
        if (mode !== 'unmounted' && armed) {
          armed = false;
          if (mode === 'reentrant-release') state.active = true;
          throw failure;
        }
      },
      true
    );
    try {
      expect(mounts).toBe(1);
      state.active = false;
      await flushVue2();
      await flushVue2();
      expect(errors).toEqual([failure]);
      if (mode !== 'reentrant-release') {
        expect(vm.__pui.owner.hasView).toBe(false);
        expect(vm.__pui.lastInitRoot).toBeNull();
        state.active = true;
      }
      await flushVue2();
      await flushVue2();
      expect(app.$refs.owner).toBe(vm);
      expect(vm.$el).toBe(root);
      expect(setups).toBe(1);
      expect(mounts).toBe(2);
      expect(vm.__pui.owner.hasView).toBe(true);
      expect(vm.__pui.lastInitRoot).toBe(root);
      expect(tree.isFocusTargetOwnerReady(root)).toBe(true);
      vm.getExposes().focus();
      expect(document.activeElement).toBe(root);
      expect(vm.getExposes().focused.get()).toBe(true);
    } finally {
      off();
      app.$destroy();
      host.remove();
      Vue2Any.config.errorHandler = previousErrorHandler;
    }
  }
);
