import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asOverlay } from '@proto.ui/hooks';
import { createVueAdapter } from '../src';
import * as tree from '../src/platform/instance-tree';
import { VueAny, flushVue } from './utils/vue';

// Actual KeepAlive and retained overlay roots. A private readiness consumer
// deliberately throws on source release; the unmounted variant observes Runtime
// rejection through Vue. No adapter/session lifecycle is mocked.
for (const failureMode of ['release', 'reentrant-release', 'unmounted'] as const)
  it.each(['keep-alive', 'retained-overlay'] as const)(
    `reattaches the same Vue host after %s ${failureMode} failure`,
    async (mode) => {
      let mounted = 0;
      let setups = 0;
      let run: any;
      const failure = new Error('readiness-release');
      const errors: unknown[] = [];
      let unmountArmed = true;
      const proto = definePrototype({
        name: `vue-detach-recovery-${mode}-${failureMode}`,
        setup(def) {
          setups++;
          const focus = asFocusable();
          def.expose.method('focus', () => focus.focusSelf());
          def.expose.state('focused', focus.focused);
          def.lifecycle.onCreated((value) => {
            run = value;
          });
          def.lifecycle.onMounted(() => {
            mounted++;
          });
          if (failureMode === 'unmounted')
            def.lifecycle.onUnmounted(() => {
              if (unmountArmed) {
                unmountArmed = false;
                throw failure;
              }
            });
          def.expose.method('hide', () => run.lifecycle.setPresent(false));
          def.expose.method('show', () => run.lifecycle.setPresent(true));
          if (mode === 'retained-overlay') {
            const present = { get: () => true, watch: () => () => {} };
            const overlay = asOverlay();
            overlay.configure({ portal: false });
            overlay.bindPresence({ enter() {}, leave() {}, present });
          }
          return (r) => r.el('span', 'Attached content');
        },
      });
      const Component = createVueAdapter(VueAny)(proto);
      const active = VueAny.ref(true),
        ref = VueAny.ref(null);
      const host = document.createElement('div');
      document.body.append(host);
      const app = VueAny.createApp({
        render: () =>
          mode === 'keep-alive'
            ? VueAny.h(VueAny.KeepAlive, null, () =>
                active.value ? VueAny.h(Component, { key: 'owner', ref }) : null
              )
            : VueAny.h(Component, { ref }),
      });
      app.config.errorHandler = (error: unknown) => errors.push(error);
      app.mount(host);
      await flushVue();
      await flushVue();
      const api = ref.value.getExposes();
      const root = host.firstElementChild as HTMLElement;
      const token = tree.getLogicalEventRouteSurfaceForTarget(root)!;
      let armed = true;
      const off = tree.subscribeFocusSurfaceReady(
        token,
        () => {
          if (armed && failureMode !== 'unmounted') {
            armed = false;
            if (failureMode === 'reentrant-release') {
              if (mode === 'keep-alive') active.value = true;
              else api.show();
            }
            throw failure;
          }
        },
        true
      );
      try {
        expect(mounted).toBe(1);
        if (mode === 'keep-alive') active.value = false;
        else ref.value.getExposes().hide();
        await flushVue();
        await flushVue();
        expect(errors).toEqual([failure]);
        if (failureMode !== 'reentrant-release') {
          expect(tree.isFocusTargetOwnerReady(root)).toBe(false);
          if (mode === 'keep-alive') active.value = true;
          else api.show();
        }
        await flushVue();
        await flushVue();
        expect(host.firstElementChild).toBe(root);
        expect(setups).toBe(1);
        expect(mounted).toBe(2);
        expect(tree.isFocusTargetOwnerReady(root)).toBe(true);
        ref.value.getExposes().focus();
        expect(document.activeElement).toBe(root);
        expect(ref.value.getExposes().focused.get()).toBe(true);
      } finally {
        off();
        app.unmount();
        host.remove();
      }
    }
  );
