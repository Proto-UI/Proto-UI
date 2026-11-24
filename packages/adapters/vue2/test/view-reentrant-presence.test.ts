import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createVue2Adapter } from '../src';
import { Vue2RuntimeAny, flushVue2, mountVue2Adapter } from './utils/vue2';

const settle = async () => {
  await flushVue2();
  await flushVue2();
};

describe('Vue2 same-node retained view reentry', () => {
  it.each(['reopen', 'hide', 'dispose'] as const)(
    'retires the old physical epoch before its unmounted callback requests %s',
    async (action) => {
      let run: any;
      let armed = false;
      const calls = { created: 0, mounted: 0, unmounted: 0, beforeDispose: 0 };
      const events: string[] = [];
      let fixture: ReturnType<typeof mountVue2Adapter>;
      const Component = createVue2Adapter(Vue2RuntimeAny)(
        definePrototype({
          name: 'vue2-retained-same-node-reentry',
          setup(def) {
            def.lifecycle.onCreated((current) => {
              run = current;
              calls.created++;
            });
            def.lifecycle.onMounted(() => calls.mounted++);
            def.lifecycle.onUnmounted((current) => {
              calls.unmounted++;
              if (!armed) return;
              armed = false;
              // This is an intentional synchronous lifecycle reentry using
              // the real Vue renderer, not a mocked commit or clock.
              current.lifecycle.setPresent(true);
              if (action === 'hide') current.lifecycle.setPresent(false);
              if (action === 'dispose') fixture.vm.$destroy();
            });
            def.lifecycle.onBeforeDispose(() => calls.beforeDispose++);
            return () => 'Retained view';
          },
        }),
        { diagnostics: { onLifecycleEvent: (event) => events.push(event.type) } }
      );
      fixture = mountVue2Adapter(Component);
      try {
        await settle();
        const root = fixture.vm.$el;
        const state = fixture.vm.__pui;
        expect(state.owner.hasView).toBe(true);
        const oldGeneration = state.viewGeneration;
        armed = true;
        fixture.vm.invokeInCallbackScope(() => run.lifecycle.setPresent(false));
        await settle();
        const observed = JSON.stringify({
          calls,
          events,
          shouldExist: fixture.vm.__puiShouldExist,
          hasView: state.owner.hasView,
          rootMatchesLastInit: fixture.vm.$el === state.lastInitRoot,
          rootUnchanged: fixture.vm.$el === root,
          viewReady: state.viewReady,
          viewGeneration: state.viewGeneration,
          terminalDisposed: state.terminalDisposed,
        });
        expect(calls.created).toBe(1);
        if (action === 'reopen') {
          // Vue batches false -> true before patching, retaining the same DOM
          // element while Proto must create exactly one fresh physical epoch.
          expect(fixture.vm.$el, observed).toBe(root);
          expect(state.owner.hasView, observed).toBe(true);
          expect(state.viewReady, observed).toBe(true);
          expect(state.viewGeneration).toBeGreaterThan(oldGeneration);
          expect(calls.mounted, observed).toBe(2);
          expect(state.eventGate?.isEnabled()).toBe(true);
          fixture.vm.update();
          fixture.vm.update();
          await settle();
          expect(calls.mounted).toBe(2);
          expect(state.owner.hasView).toBe(true);
        } else {
          expect(state.owner.hasView, observed).toBe(false);
          expect(calls.mounted, observed).toBe(1);
          if (action === 'dispose') {
            expect(state.terminalDisposed).toBe(true);
            expect(calls.beforeDispose).toBe(1);
          } else {
            expect(fixture.vm.__puiShouldExist).toBe(false);
            expect(state.terminalDisposed).toBe(false);
          }
        }
      } finally {
        fixture.unmount();
        await settle();
      }
    }
  );
});
