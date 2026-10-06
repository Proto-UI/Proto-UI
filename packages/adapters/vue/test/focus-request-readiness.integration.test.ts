import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createVueAdapter } from '../src/adapt';
import { asButton } from '../../../prototypes/base/src/button';
import { createMountedVueAdapterWithOptions, flushVue, VueAny } from './utils/vue';

// Actual Vue lifecycle and Adapter gates with happy-dom focus delivery. These
// observations are simulated-DOM evidence, not native browser ordering proof.
afterEach(() => vi.restoreAllMocks());

it.each(['programmatic', 'native', 'entry'] as const)(
  'preserves %s admission and facts through the actual Vue onUpdated gate',
  async (kind) => {
    let request = false;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    let root: HTMLElement;
    const proto = definePrototype({
      name: `vue-focus-kind-${kind}`,
      setup(def) {
        const target = asFocusable();
        const entry = asFocusEntry();
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.expose.state('focused', target.focused);
        def.lifecycle.onUpdated(() => {
          if (!request) return;
          request = false;
          if (kind === 'programmatic') target.focus();
          else if (kind === 'native') target.focusSelf();
          else entry.focus();
          during.push({ active: document.activeElement === root, focused: target.focused.get() });
        });
        return () => 'Focus kind';
      },
    });
    const mounted = createMountedVueAdapterWithOptions(proto, { rootTag: 'button' });
    try {
      await flushVue();
      root = mounted.root!;
      request = true;
      mounted.vm.update();
      await flushVue();
      await flushVue();
      const observed = {
        during,
        after: {
          active: document.activeElement === root,
          focused: mounted.vm.getExposes().focused.get(),
        },
      };
      console.info('[vue-focus-kind]', JSON.stringify({ kind, ...observed }));
      expect(observed).toEqual({
        during: [{ active: kind === 'programmatic', focused: kind === 'programmatic' }],
        after: { active: true, focused: true },
      });
    } finally {
      mounted.unmount();
    }
  }
);

it('keeps committed physical blur independent of the Vue acquisition gate', async () => {
  let blur = false;
  let calls = 0;
  const proto = definePrototype({
    name: 'vue-focus-updated-blur-control',
    setup(def) {
      const target = asFocusable();
      def.expose.state('focused', target.focused);
      def.lifecycle.onUpdated(() => {
        if (!blur) return;
        blur = false;
        calls++;
        target.blur();
      });
      return () => 'Blur target';
    },
  });
  const mounted = createMountedVueAdapterWithOptions(proto, { rootTag: 'button' });
  try {
    await flushVue();
    mounted.root!.focus();
    expect(mounted.vm.getExposes().focused.get()).toBe(true);
    blur = true;
    mounted.vm.update();
    await flushVue();
    await flushVue();
    expect(calls).toBe(1);
    expect(document.activeElement).not.toBe(mounted.root);
    expect(mounted.vm.getExposes().focused.get()).toBe(false);
  } finally {
    mounted.unmount();
  }
});

it.each(['entry', 'entry-disable', 'entry-blur', 'native'] as const)(
  'waits for the actual nested Vue owner and preserves cancellation: %s',
  async (mode) => {
    const host = document.createElement('div');
    document.body.append(host);
    const outerRef = VueAny.ref(null);
    const innerRef = VueAny.ref(null);
    let request = false;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    const outerProto = definePrototype({
      name: `vue-owner-outer-${mode}`,
      setup(def) {
        if (mode === 'native') asButton();
        else {
          const entry = asFocusEntry();
          const target = asFocusable();
          entry.configure({ strategy: 'descendant-first', fallback: 'none' });
          def.expose.method('enter', () => entry.focus());
          def.expose.method('cancelEntry', () => entry.setDisabled(true));
          def.expose.method('blur', () => target.blur());
        }
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `vue-owner-inner-${mode}`,
      setup(def) {
        if (mode === 'native') asButton();
        else {
          const target = asFocusable();
          def.expose.state('focused', target.focused);
        }
        def.expose.event('beforeReady');
        def.lifecycle.onUpdated((run) => run.expose.emit('beforeReady'));
        return () => 'Nested target';
      },
    });
    const adapt = createVueAdapter(VueAny);
    const Outer = adapt(outerProto);
    const Inner = adapt(innerProto, { rootTag: 'button' });
    const app = VueAny.createApp({
      render: () =>
        VueAny.h(Outer, { ref: outerRef }, () => [
          VueAny.h(Inner, {
            ref: innerRef,
            onBeforeReady: () => {
              if (!request) return;
              request = false;
              const exposes = outerRef.value.getExposes();
              if (mode === 'native') exposes.focusSelf();
              else exposes.enter();
              during.push({
                active: document.activeElement === host.querySelector('button'),
                focused: innerRef.value.getExposes().focused.get(),
              });
              if (mode === 'entry-disable') exposes.cancelEntry();
              if (mode === 'entry-blur') exposes.blur();
            },
          }),
        ]),
    });
    try {
      app.mount(host);
      await flushVue();
      await flushVue();
      const target = host.querySelector('button')!;
      request = true;
      innerRef.value.update();
      await flushVue();
      await flushVue();
      expect(during).toEqual([{ active: false, focused: false }]);
      const applies = mode === 'entry' || mode === 'native';
      expect(document.activeElement === target).toBe(applies);
      expect(innerRef.value.getExposes().focused.get()).toBe(applies);
    } finally {
      app.unmount();
      host.remove();
    }
  }
);

it('delegates plain descendant entry after readiness without inventing region facts', async () => {
  let request = false;
  let during = true;
  const proto = definePrototype({
    name: 'vue-entry-only-descendant',
    setup(def) {
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.lifecycle.onUpdated(() => {
        if (!request) return;
        request = false;
        entry.focus();
        during = document.activeElement === mounted.host.querySelector('button');
      });
      return (r) => r.el('button', 'Plain descendant');
    },
  });
  const mounted = createMountedVueAdapterWithOptions(proto);
  try {
    await flushVue();
    request = true;
    mounted.vm.update();
    await flushVue();
    await flushVue();
    expect(during).toBe(false);
    expect(document.activeElement).toBe(mounted.host.querySelector('button'));
    expect(mounted.vm.getExposes()).not.toHaveProperty('focused');
    expect(mounted.vm.getExposes()).not.toHaveProperty('focusVisible');
    expect(mounted.vm.getExposes()).not.toHaveProperty('active');
  } finally {
    mounted.unmount();
  }
});

it.each(['retained', 'terminal'] as const)(
  're-resolves entry to an already-ready sibling when the rejected ordinary Vue owner is removed: %s',
  async (removal) => {
    const host = document.createElement('div');
    document.body.append(host);
    const outerRef = VueAny.ref(null);
    const firstRef = VueAny.ref(null);
    const fallbackRef = VueAny.ref(null);
    const showFirst = VueAny.ref(true);
    let request = false;
    const during: boolean[] = [];
    const outerProto = definePrototype({
      name: `vue-disappearing-entry-${removal}`,
      setup(def) {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('enter', () => entry.focus());
        return (r) => r.slot();
      },
    });
    const firstProto = definePrototype({
      name: `vue-disappearing-owner-${removal}`,
      setup(def) {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        def.lifecycle.onUpdated((run) => {
          if (!request) return;
          request = false;
          outerRef.value.getExposes().enter();
          during.push(document.activeElement === host.querySelector('button'));
          if (removal === 'retained') run.lifecycle.setPresent(false);
          else showFirst.value = false;
        });
        return () => 'Old target';
      },
    });
    const fallbackProto = definePrototype({
      name: `vue-fallback-owner-${removal}`,
      setup(def) {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        return () => 'Fallback target';
      },
    });
    const adapt = createVueAdapter(VueAny);
    const Outer = adapt(outerProto);
    const First = adapt(firstProto, { rootTag: 'button' });
    const Fallback = adapt(fallbackProto, { rootTag: 'button' });
    const app = VueAny.createApp({
      render: () =>
        VueAny.h(Outer, { ref: outerRef }, () => [
          showFirst.value ? VueAny.h(First, { ref: firstRef }) : null,
          VueAny.h(Fallback, { ref: fallbackRef }),
        ]),
    });
    try {
      app.mount(host);
      await flushVue();
      await flushVue();
      const [oldTarget, fallback] = host.querySelectorAll('button');
      request = true;
      firstRef.value.update();
      await flushVue();
      await flushVue();
      await flushVue();
      expect(during).toEqual([false]);
      expect(oldTarget.isConnected).toBe(false);
      expect(document.activeElement).toBe(fallback);
      expect(fallbackRef.value.getExposes().focused.get()).toBe(true);
    } finally {
      app.unmount();
      host.remove();
    }
  }
);

it('does not announce an older Vue commit as ready while onUpdated schedules a newer commit', async () => {
  let updates = 0;
  let requested = false;
  const observations: Array<{ update: number; active: boolean; focused: boolean }> = [];
  const proto = definePrototype({
    name: 'vue-focus-reentrant-commit',
    setup(def) {
      const target = asFocusable();
      def.expose.state('focused', target.focused);
      def.lifecycle.onUpdated(() => {
        if (!requested) return;
        updates++;
        if (updates === 1) {
          target.focusSelf();
          mounted.vm.update();
        }
        observations.push({
          update: updates,
          active: document.activeElement === mounted.root,
          focused: target.focused.get(),
        });
      });
      return () => 'Reentrant target';
    },
  });
  const mounted = createMountedVueAdapterWithOptions(proto, {
    rootTag: 'button',
    schedule: (task: () => void) => task(),
  });
  try {
    await flushVue();
    await flushVue();
    requested = true;
    mounted.vm.update();
    await flushVue();
    await flushVue();
    await flushVue();
    expect(observations).toEqual([
      { update: 1, active: false, focused: false },
      { update: 2, active: false, focused: false },
    ]);
    expect(document.activeElement).toBe(mounted.root);
    expect(mounted.vm.getExposes().focused.get()).toBe(true);
  } finally {
    mounted.unmount();
  }
});
