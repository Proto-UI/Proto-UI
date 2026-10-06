import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asFocusEntry } from '@proto.ui/hooks';
import { asButton } from '../../../prototypes/base/src/button';
import { createVue2Adapter } from '../src';
import { getLogicalRoot } from '../src/platform/instance-tree';
import {
  createMountedVue2Adapter,
  mountVue2Adapter,
  flushVue2,
  Vue2Any,
  Vue2RuntimeAny,
} from './utils/vue2';

// Actual Vue2 lifecycle/event ingress in happy-dom. The failure/throw variants
// control only the old host focus method, not gates, callback phases or facts.
for (const outcome of ['success', 'rejected', 'throws'] as const) {
  it.each(['programmatic', 'native', 'entry'] as const)(
    `retains a new %s request from onUnmounted with old host ${outcome}`,
    async (kind) => {
      let run: any;
      let request = false;
      let oldTarget: HTMLElement;
      const caught: string[] = [];
      const during: Array<{ connected: boolean; active: boolean; focused: boolean }> = [];
      const proto = definePrototype({
        name: `vue2-new-unmounted-${kind}-${outcome}`,
        setup(def) {
          const target = asFocusable();
          const entry = asFocusEntry();
          entry.configure({ strategy: 'self', fallback: 'self' });
          const focus = () => {
            if (kind === 'programmatic') target.focus();
            else if (kind === 'native') target.focusSelf();
            else entry.focus();
          };
          def.expose.state('focused', target.focused);
          def.expose.method('request', focus);
          def.lifecycle.onCreated((value) => {
            run = value;
          });
          def.expose('view', {
            hide: () => run.lifecycle.setPresent(false),
            show: () => run.lifecycle.setPresent(true),
          });
          def.lifecycle.onUnmounted(() => {
            if (!request) return;
            request = false;
            try {
              focus();
            } catch (error) {
              caught.push((error as Error).message);
            }
            during.push({
              connected: oldTarget.isConnected,
              active: document.activeElement === oldTarget,
              focused: target.focused.get(),
            });
          });
          return () => 'Teardown focus target';
        },
      });
      const mounted = createMountedVue2Adapter(proto);
      let focusSpy: ReturnType<typeof vi.spyOn> | undefined;
      try {
        await flushVue2();
        oldTarget = mounted.host.firstElementChild as HTMLElement;
        if (outcome !== 'success')
          focusSpy = vi.spyOn(oldTarget, 'focus').mockImplementation(() => {
            if (outcome === 'throws') throw new Error('old host focus failed');
          });
        request = true;
        mounted.vm.getExposes().view.hide();
        await flushVue2();
        const accepted = kind === 'programmatic' && outcome === 'success';
        expect(during).toEqual([{ connected: true, active: accepted, focused: accepted }]);
        if (focusSpy) expect(focusSpy).toHaveBeenCalledTimes(kind === 'programmatic' ? 1 : 0);
        const threw = kind === 'programmatic' && outcome === 'throws';
        expect(caught).toEqual(threw ? ['old host focus failed'] : []);
        mounted.vm.getExposes().view.show();
        await flushVue2();
        await flushVue2();
        const replacement = mounted.host.firstElementChild as HTMLElement;
        expect(replacement).not.toBe(oldTarget);
        expect(document.activeElement === replacement).toBe(!threw);
        expect(mounted.vm.getExposes().focused.get()).toBe(!threw);
        // An explicit fresh request remains usable after a propagated host error.
        mounted.vm.getExposes().request();
        await flushVue2();
        expect(document.activeElement).toBe(replacement);
        expect(mounted.vm.getExposes().focused.get()).toBe(true);
      } finally {
        focusSpy?.mockRestore();
        mounted.unmount();
      }
    }
  );
}

it.each(['programmatic', 'native', 'entry'] as const)(
  'keeps Vue2 %s onUpdated focus synchronous after its gate is already reopened',
  async (kind) => {
    let run: any;
    let request = false;
    let root: HTMLElement;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    const proto = definePrototype({
      name: `vue2-updated-open-gate-${kind}`,
      setup(def) {
        const target = asFocusable();
        const entry = asFocusEntry();
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose.method('update', () => run.update());
        def.lifecycle.onUpdated(() => {
          if (!request) return;
          request = false;
          if (kind === 'programmatic') target.focus();
          else if (kind === 'native') target.focusSelf();
          else entry.focus();
          during.push({ active: document.activeElement === root, focused: target.focused.get() });
        });
        return () => 'Updated target';
      },
    });
    const mounted = createMountedVue2Adapter(proto);
    try {
      await flushVue2();
      root = mounted.root!;
      request = true;
      mounted.vm.getExposes().update();
      await flushVue2();
      expect(during).toEqual([{ active: true, focused: true }]);
    } finally {
      mounted.unmount();
    }
  }
);

it.each(['native', 'entry', 'entry-disable'] as const)(
  'uses the departing nested event owner and preserves fallback/cancellation: %s',
  async (kind) => {
    let run: any;
    let request = false;
    let requester: any;
    let targetVm: any;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    const outerProto = definePrototype({
      name: `vue2-teardown-outer-${kind}`,
      setup(def) {
        if (kind === 'native') asButton();
        else {
          const entry = asFocusEntry();
          entry.configure({ strategy: 'descendant-first', fallback: 'none' });
          def.expose.method('enter', () => entry.focus());
          def.expose.method('disable', () => entry.setDisabled(true));
        }
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `vue2-teardown-inner-${kind}`,
      setup(def) {
        if (kind === 'native') asButton();
        else {
          const target = asFocusable();
          def.expose.state('focused', target.focused);
        }
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose('view', { hide: () => run.lifecycle.setPresent(false) });
        def.lifecycle.onUnmounted(() => {
          if (!request) return;
          request = false;
          if (kind === 'native') requester.getExposes().focusSelf();
          else requester.getExposes().enter();
          during.push({
            active: document.activeElement === targetVm.$el,
            focused: targetVm.getExposes().focused.get(),
          });
          if (kind === 'entry-disable') requester.getExposes().disable();
        });
        return () => 'Old target';
      },
    });
    const fallbackProto = definePrototype({
      name: `vue2-teardown-fallback-${kind}`,
      setup(def) {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        return () => 'Fallback';
      },
    });
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Outer = adapt(outerProto),
      Inner = adapt(innerProto),
      Fallback = adapt(fallbackProto);
    const App = Vue2Any.extend({
      render(h: any) {
        return h(Outer, { ref: 'outer' }, [
          h(Inner, { ref: 'inner' }),
          ...(kind === 'native' ? [] : [h(Fallback, { ref: 'fallback' })]),
        ]);
      },
    });
    const app = new App().$mount();
    document.body.append(app.$el);
    try {
      await flushVue2();
      await flushVue2();
      requester = app.$refs.outer;
      targetVm = app.$refs.inner;
      request = true;
      targetVm.getExposes().view.hide();
      await flushVue2();
      await flushVue2();
      expect(during).toEqual([{ active: false, focused: false }]);
      const fallback = kind === 'native' ? requester : app.$refs.fallback;
      expect(document.activeElement === fallback.$el).toBe(kind !== 'entry-disable');
      expect(fallback.getExposes().focused.get()).toBe(kind !== 'entry-disable');
    } finally {
      app.$destroy();
      app.$el.remove();
    }
  }
);

it('cleans old view binding when a pending outer programmatic focus throws during source release', async () => {
  let innerRun: any, focus: any;
  const Outer = createVue2Adapter(Vue2RuntimeAny)(
    definePrototype({
      name: 'review-vue2-outer-exception',
      setup(def) {
        asButton();
        focus = asFocusable();
        def.expose.method('request', () => focus.focus());
        return (r) => r.slot();
      },
    })
  );
  const Inner = createVue2Adapter(Vue2RuntimeAny)(
    definePrototype({
      name: 'review-vue2-inner-exception',
      setup(def) {
        asButton();
        def.lifecycle.onCreated((r) => (innerRun = r));
        def.expose.method('hide', () => innerRun.lifecycle.setPresent(false));
        def.expose.method('show', () => innerRun.lifecycle.setPresent(true));
        return () => 'Target';
      },
    })
  );
  const App = Vue2Any.extend({
    render(h: any) {
      return h(Outer, { ref: 'outer' }, [h(Inner, { ref: 'inner' })]);
    },
  });
  const app = new App().$mount();
  document.body.append(app.$el);
  await flushVue2();
  await flushVue2();
  const inner = app.$refs.inner,
    outer = app.$refs.outer,
    old = inner.$el;
  let throwing = false;
  const spy = vi.spyOn(old, 'focus').mockImplementation(() => {
    if (throwing) throw new Error('review host failure');
  });
  outer.getExposes().request();
  throwing = true;
  let err: any;
  try {
    inner.getExposes().hide();
  } catch (e) {
    err = e;
  }

  spy.mockRestore();
  await flushVue2();
  try {
    expect(getLogicalRoot(inner.__pui.instanceToken)).not.toBe(old);
    expect(inner.__pui.eventGate).toBeNull();
    expect(inner.__pui.owner.hasView).toBe(false);
    expect(inner.__pui.viewReady).toBe(false);
    expect(inner.__pui.lastInitRoot).toBeNull();
    expect(err).toBeUndefined(); // The detached old target is no longer re-resolved.
    inner.getExposes().show();
    await flushVue2();
    await flushVue2();
    expect(inner.__pui.owner.hasView).toBe(true);
    expect(getLogicalRoot(inner.__pui.instanceToken)).toBe(inner.$el);
    outer.getExposes().request();
    expect(document.activeElement).toBe(inner.$el);
    expect(focus.focused.get()).toBe(true);
  } finally {
    app.$destroy();
    app.$el.remove();
  }
});

it('publishes mounted diagnostics before a ready-triggered reentrant update', async () => {
  let run: any,
    updated = false;
  const trace: string[] = [];
  const proto = definePrototype({
    name: 'vue2-mounted-diagnostics',
    setup(def) {
      const target = asFocusable();
      def.lifecycle.onCreated((r) => {
        run = r;
        target.focusSelf();
      });
      target.focused.watch((_ctx, e) => {
        if (e.type === 'next' && e.next && !updated) {
          updated = true;
          run.update();
        }
      });
      return () => 'Ready';
    },
  });
  const options = {
    schedule: (task: () => void) => task(),
    diagnostics: {
      onLifecycleEvent: (event: any) =>
        trace.push(event.type + (event.phase ? ':' + event.phase : '')),
    },
  };
  const mounted = mountVue2Adapter(createVue2Adapter(Vue2RuntimeAny)(proto, options));
  await flushVue2();
  await flushVue2();
  const cleanup = () => mounted.unmount();
  try {
    expect(updated).toBe(true);
    expect(trace.indexOf('mount.phase:mounted')).toBeLessThan(trace.indexOf('update.render'));
  } finally {
    cleanup();
  }
});

import * as readiness from '../src/platform/instance-tree';

function sourceLeaseFixture() {
  const proto = definePrototype({ name: 'focus-source-lease', setup() {} });
  const token = readiness.createLogicalInstance(proto),
    root = document.createElement('div');
  readiness.markProtoInstance(root, proto, token);
  const source = () => ({ isReady: () => true, subscribe: (_listener: () => void) => () => {} });
  return { token, root, source, cleanup: () => readiness.unbindProtoInstance(token, root) };
}
it('retains a releasable deferred source when publication observers throw', () => {
  const f = sourceLeaseFixture(),
    failure = new Error('source observer failure');
  const second = vi.fn();
  const offFirst = readiness.subscribeFocusSurfaceReady(
    f.token,
    () => {
      throw failure;
    },
    true
  );
  const offSecond = readiness.subscribeFocusSurfaceReady(f.token, second, true);
  const release = readiness.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  try {
    expect(second).not.toHaveBeenCalled();
    expect(() => release.publish()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(1);
    expect(() => release()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(2);
    expect(readiness.isFocusTargetOwnerReady(f.root)).toBe(false);
  } finally {
    offFirst();
    offSecond();
    release();
    f.cleanup();
  }
});
it('ignores stale publication and release after a source is replaced or disposed', () => {
  const f = sourceLeaseFixture(),
    notify = vi.fn();
  const off = readiness.subscribeFocusSurfaceReady(f.token, notify, true);
  const old = readiness.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  const current = readiness.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  try {
    old.publish();
    old();
    expect(notify).not.toHaveBeenCalled();
    expect(readiness.isFocusTargetOwnerReady(f.root)).toBe(true);
    current.publish();
    expect(notify).toHaveBeenCalledTimes(1);
    current();
    expect(notify).toHaveBeenCalledTimes(2);
    current.publish();
    expect(notify).toHaveBeenCalledTimes(2);
  } finally {
    off();
    current();
    old();
    f.cleanup();
  }
});

it('Vue2 releases failed remount marker bindings after focus observer throw and later hide', async () => {
  let run: any;
  const errors: any[] = [];
  const Outer = createVue2Adapter(Vue2RuntimeAny)(
    definePrototype({
      name: 'review-vue2-marker-outer',
      setup(def) {
        asButton();
        const f = asFocusable();
        def.expose.method('request', () => f.focus());
        return (r) => r.slot();
      },
    })
  );
  const Inner = createVue2Adapter(Vue2RuntimeAny)(
    definePrototype({
      name: 'review-vue2-marker-inner',
      setup(def) {
        asButton();
        def.lifecycle.onCreated((r) => (run = r));
        def.expose.method('hide', () => run.lifecycle.setPresent(false));
        def.expose.method('show', () => run.lifecycle.setPresent(true));
        return (r) => r.el('span', 'Owned view child');
      },
    })
  );
  const App = Vue2Any.extend({
    render(h: any) {
      return h(Outer, { ref: 'outer' }, [h(Inner, { ref: 'inner' })]);
    },
  });
  const app = new App().$mount();
  document.body.append(app.$el);
  await flushVue2();
  await flushVue2();
  const outer = app.$refs.outer,
    inner = app.$refs.inner,
    old = inner.$el,
    token = readiness.getLogicalEventRouteSurfaceForTarget(old)!,
    outerRoot = outer.$el;
  inner.getExposes().hide();
  await flushVue2();
  await flushVue2();
  const prev = Vue2Any.config.errorHandler;
  Vue2Any.config.errorHandler = (error: any) => errors.push(error);
  const failure = new Error('vue2 new-target focus failure');
  const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this !== outerRoot) throw failure;
  });
  try {
    outer.getExposes().request();
    inner.getExposes().show();
    await flushVue2();
    await flushVue2();
    spy.mockRestore();
    inner.getExposes().hide();
    await flushVue2();
    expect(readiness.getLogicalRoot(token)).toBeNull();
    expect(errors).toContain(failure);
    inner.getExposes().show();
    await flushVue2();
    await flushVue2();
    const recovered = readiness.getLogicalRoot(token)!;
    expect(recovered.isConnected).toBe(true);
    expect(readiness.isNativeFocusTargetReady(recovered)).toBe(true);
    outer.getExposes().request();
    expect(document.activeElement).toBe(recovered);
  } finally {
    spy.mockRestore();
    Vue2Any.config.errorHandler = prev;
    app.$destroy();
    app.$el.remove();
  }
});
