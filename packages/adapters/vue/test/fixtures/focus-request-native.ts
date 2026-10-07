import * as Vue from 'vue';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { asButton } from '../../../../prototypes/base/src/button';
import { createVueAdapter } from '../../src';

// Isolated first-party native-browser fixture. Vue, focus(), event ingress, and
// requestAnimationFrame are all real and unmodified. No application/network data.
const adapt = createVueAdapter(Vue as any);
const settleVue = async () => {
  // Settle Vue's render, the Adapter's commit acknowledgement, and updates
  // requested by lifecycle callbacks. These are host commit boundaries.
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
  await Promise.resolve();
};
const layout = async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

export async function observeFocusKind(kind: 'programmatic' | 'native' | 'entry') {
  const host = document.createElement('div');
  document.body.append(host);
  const ref = Vue.ref<any>(null);
  let request = false;
  let trustedFocusEvents = 0;
  const during: Array<{ active: boolean; focused: boolean }> = [];
  const proto = definePrototype({
    name: `native-vue-focus-kind-${kind}`,
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
        during.push({
          active: document.activeElement === host.querySelector('button'),
          focused: target.focused.get(),
        });
      });
      return () => 'Native Vue request kind';
    },
  });
  const Component = adapt(proto, { rootTag: 'button' });
  const app = Vue.createApp({ render: () => Vue.h(Component, { ref }) });
  try {
    app.mount(host);
    await settleVue();
    await layout();
    const target = host.querySelector('button')!;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFocusEvents++;
    });
    request = true;
    ref.value.update();
    await settleVue();
    return {
      during,
      after: {
        active: document.activeElement === target,
        focused: ref.value.getExposes().focused.get(),
      },
      trustedFocusEvents,
    };
  } finally {
    app.unmount();
    host.remove();
  }
}

export async function observeNestedOwner(
  mode: 'entry' | 'entry-disable' | 'entry-blur' | 'native'
) {
  const host = document.createElement('div');
  document.body.append(host);
  const outerRef = Vue.ref<any>(null);
  const innerRef = Vue.ref<any>(null);
  let request = false;
  let trustedFocusEvents = 0;
  const during: Array<{ active: boolean; focused: boolean }> = [];
  const outerProto = definePrototype({
    name: `native-vue-outer-owner-${mode}`,
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
    name: `native-vue-inner-owner-${mode}`,
    setup(def) {
      if (mode === 'native') asButton();
      else {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
      }
      def.expose.event('beforeReady');
      def.lifecycle.onUpdated((run) => run.expose.emit('beforeReady'));
      return () => 'Actual nested owner';
    },
  });
  const Outer = adapt(outerProto);
  const Inner = adapt(innerProto, { rootTag: 'button' });
  const focus = () => {
    const exposes = outerRef.value.getExposes();
    if (mode === 'native') exposes.focusSelf();
    else exposes.enter();
  };
  const app = Vue.createApp({
    render: () =>
      Vue.h(Outer, { ref: outerRef }, () => [
        Vue.h(Inner, {
          ref: innerRef,
          onBeforeReady: () => {
            if (!request) return;
            request = false;
            focus();
            during.push({
              active: document.activeElement === host.querySelector('button'),
              focused: innerRef.value.getExposes().focused.get(),
            });
            if (mode === 'entry-disable') outerRef.value.getExposes().cancelEntry();
            if (mode === 'entry-blur') outerRef.value.getExposes().blur();
          },
        }),
      ]),
  });
  try {
    app.mount(host);
    await settleVue();
    await layout();
    const target = host.querySelector('button')!;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFocusEvents++;
    });
    focus();
    await settleVue();
    const readyControl = {
      active: document.activeElement === target,
      focused: innerRef.value.getExposes().focused.get(),
    };
    target.blur();
    await settleVue();
    trustedFocusEvents = 0;
    request = true;
    innerRef.value.update();
    await settleVue();
    return {
      readyControl,
      during,
      after: {
        active: document.activeElement === target,
        focused: innerRef.value.getExposes().focused.get(),
      },
      trustedFocusEvents,
    };
  } finally {
    app.unmount();
    host.remove();
  }
}

export async function observeOwnerRemoval(removal: 'retained' | 'terminal') {
  const host = document.createElement('div');
  document.body.append(host);
  const outerRef = Vue.ref<any>(null);
  const firstRef = Vue.ref<any>(null);
  const fallbackRef = Vue.ref<any>(null);
  const showFirst = Vue.ref(true);
  let request = false;
  let oldTarget: HTMLElement;
  let trustedOldFocusEvents = 0;
  let trustedFallbackFocusEvents = 0;
  const during: Array<{ connected: boolean; active: boolean; focused: boolean }> = [];
  const outerProto = definePrototype({
    name: `native-vue-disappearing-entry-${removal}`,
    setup(def) {
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.expose.method('enter', () => entry.focus());
      return (r) => r.slot();
    },
  });
  const firstProto = definePrototype({
    name: `native-vue-departing-owner-${removal}`,
    setup(def) {
      const target = asFocusable();
      const enterWhileClosed = () => {
        request = false;
        outerRef.value.getExposes().enter();
        during.push({
          connected: oldTarget.isConnected,
          active: document.activeElement === oldTarget,
          focused: target.focused.get(),
        });
      };
      def.lifecycle.onUpdated((run) => {
        if (!request || removal !== 'retained') return;
        enterWhileClosed();
        run.lifecycle.setPresent(false);
      });
      def.lifecycle.onUnmounted(() => {
        // Terminal cleanup closes the gate before removing this connected node.
        if (request && removal === 'terminal') enterWhileClosed();
      });
      return () => 'Departing ordinary owner';
    },
  });
  const fallbackProto = definePrototype({
    name: `native-vue-fallback-owner-${removal}`,
    setup(def) {
      const target = asFocusable();
      def.expose.state('focused', target.focused);
      return () => 'Already-ready fallback owner';
    },
  });
  const Outer = adapt(outerProto);
  const First = adapt(firstProto, { rootTag: 'button' });
  const Fallback = adapt(fallbackProto, { rootTag: 'button' });
  const app = Vue.createApp({
    render: () =>
      Vue.h(Outer, { ref: outerRef }, () => [
        showFirst.value ? Vue.h(First, { ref: firstRef }) : null,
        Vue.h(Fallback, { ref: fallbackRef }),
      ]),
  });
  try {
    app.mount(host);
    await settleVue();
    await layout();
    const targets = host.querySelectorAll('button');
    oldTarget = targets[0];
    const fallback = targets[1];
    oldTarget.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedOldFocusEvents++;
    });
    fallback.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFallbackFocusEvents++;
    });
    request = true;
    if (removal === 'retained') firstRef.value.update();
    else showFirst.value = false;
    await settleVue();
    await settleVue();
    return {
      during,
      oldConnected: oldTarget.isConnected,
      after: {
        active: document.activeElement === fallback,
        focused: fallbackRef.value.getExposes().focused.get(),
      },
      trustedOldFocusEvents,
      trustedFallbackFocusEvents,
    };
  } finally {
    request = false;
    app.unmount();
    host.remove();
  }
}
