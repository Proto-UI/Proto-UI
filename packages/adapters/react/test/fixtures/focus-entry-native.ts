import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createReactAdapter } from '../../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const layoutFrames = async (count: number) => {
  for (let i = 0; i < count; i++)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

export async function observeEntryOwner(completion: 'apply' | 'entry-disable' | 'explicit-blur') {
  const outerProto = definePrototype({
    name: 'native-entry-owner-outer',
    setup(def) {
      const entry = asFocusEntry();
      const target = asFocusable();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.expose.method('enter', () => entry.focus({ reason: 'keyboard' }));
      def.expose.method('cancelEntry', () => entry.setDisabled(true));
      def.expose.method('blur', () => target.blur());
      return (r) => r.slot();
    },
  });
  const innerProto = definePrototype({
    name: 'native-entry-owner-inner',
    setup(def) {
      const target = asFocusable();
      def.expose.state('focused', target.focused);
      def.expose.event('beforeReady');
      def.lifecycle.onUpdated((run) => run.expose.emit('beforeReady'));
      return () => 'Nested native focus target';
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const outer = React.createRef<any>();
  const inner = React.createRef<any>();
  const adapt = createReactAdapter(React);
  const Outer = adapt(outerProto);
  const Inner = adapt(innerProto, { rootTag: 'button' });
  const during: Array<{ active: boolean; focused: boolean }> = [];
  let request = false;
  let trustedFocusEvents = 0;
  try {
    await act(async () =>
      root.render(
        React.createElement(
          Outer,
          { ref: outer },
          React.createElement(Inner, {
            ref: inner,
            onBeforeReady: () => {
              if (!request) return;
              request = false;
              outer.current.getExposes().enter();
              during.push({
                active: document.activeElement === host.querySelector('button'),
                focused: inner.current.getExposes().focused.get(),
              });
              if (completion === 'entry-disable') outer.current.getExposes().cancelEntry();
              if (completion === 'explicit-blur') outer.current.getExposes().blur();
            },
          })
        )
      )
    );
    await layoutFrames(3);
    const target = host.querySelector('button')!;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFocusEvents++;
    });
    await act(async () => outer.current.getExposes().enter());
    const readyControl = {
      active: document.activeElement === target,
      focused: inner.current.getExposes().focused.get(),
    };
    await act(async () => target.blur());
    trustedFocusEvents = 0;
    request = true;
    await act(async () => inner.current.update());
    return {
      readyControl,
      during,
      after: {
        active: document.activeElement === target,
        focused: inner.current.getExposes().focused.get(),
      },
      trustedFocusEvents,
    };
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

export async function observeRepeatedEntry() {
  const proto = definePrototype({
    name: 'native-entry-retry-owner',
    setup(def) {
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.expose.method('enter', () => entry.focus());
      return (r) => r.el('button', 'Layout-dependent descendant');
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  const Component = createReactAdapter(React)(proto);
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    await layoutFrames(3);
    const target = host.querySelector('button')!;
    const cycles: Array<{ connected: boolean; rejected: boolean; acquired: boolean }> = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      await act(async () => target.blur());
      // An authored isolated fixture CSS change makes connected native focus
      // genuinely inapplicable. The focus API and rAF delivery are unmodified.
      target.style.display = 'none';
      await act(async () => ref.current.getExposes().enter());
      const rejected = document.activeElement !== target;
      target.style.removeProperty('display');
      await layoutFrames(3);
      cycles.push({
        connected: target.isConnected,
        rejected,
        acquired: document.activeElement === target,
      });
    }
    await act(async () => target.blur());
    target.style.display = 'none';
    await act(async () => ref.current.getExposes().enter());
    // Three bounded retries each cross two real animation-frame boundaries.
    // Keep CSS rejection in place until that existing budget is exhausted.
    await layoutFrames(8);
    const exhausted = document.activeElement !== target;
    await act(async () => ref.current.getExposes().enter());
    const supersedingRejected = document.activeElement !== target;
    target.style.removeProperty('display');
    await layoutFrames(3);
    const supersedingAcquired = document.activeElement === target;
    return { cycles, exhausted, supersedingRejected, supersedingAcquired };
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

export async function observeFocusKind(kind: 'programmatic' | 'native' | 'entry') {
  let request = false;
  let trustedFocusEvents = 0;
  const during: Array<{ active: boolean; focused: boolean }> = [];
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  const proto = definePrototype({
    name: `native-request-kind-${kind}`,
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
      return () => 'Actual request kind';
    },
  });
  const Component = createReactAdapter(React)(proto, { rootTag: 'button' });
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    await layoutFrames(3);
    const target = host.querySelector('button')!;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFocusEvents++;
    });
    request = true;
    await act(async () => ref.current.update());
    return {
      during,
      after: {
        active: document.activeElement === target,
        focused: ref.current.getExposes().focused.get(),
      },
      trustedFocusEvents,
    };
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

export async function observeOrdinaryOwnerDisposal(mode: 'retained-hide' | 'terminal-unmount') {
  let request = false,
    firstRun: any,
    terminalRemove: () => void = () => {};
  const timeline: any[] = [];
  const outerProto = definePrototype({
    name: `ordinary-entry-${mode}`,
    setup(def) {
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.expose.method('enter', () => entry.focus());
      return (r) => r.slot();
    },
  });
  const firstProto = definePrototype({
    name: `ordinary-first-${mode}`,
    setup(def) {
      asFocusable();
      def.lifecycle.onCreated((run) => (firstRun = run));
      def.expose.method('hide', () => firstRun.lifecycle.setPresent(false));
      def.lifecycle.onUnmounted(() => {
        timeline.push({
          phase: 'unmounted',
          connected: firstNode?.isConnected,
          active: document.activeElement === firstNode,
        });
        if (request) {
          request = false;
          outerRef.current.getExposes().enter();
          timeline.push({ phase: 'requested', active: document.activeElement === firstNode });
        }
      });
      return () => 'old';
    },
  });
  const secondProto = definePrototype({
    name: `ordinary-fallback-${mode}`,
    setup(def) {
      const focusable = asFocusable();
      def.expose.state('focused', focusable.focused);
      return () => 'fallback';
    },
  });
  const adapt = createReactAdapter(React),
    Outer = adapt(outerProto),
    First = adapt(firstProto, { rootTag: 'button' }),
    Second = adapt(secondProto, { rootTag: 'button' });
  const outerRef = React.createRef<any>(),
    firstRef = React.createRef<any>(),
    fallbackRef = React.createRef<any>();
  let firstNode: HTMLButtonElement | undefined;
  function FirstSlot() {
    const [visible, setVisible] = React.useState(true);
    terminalRemove = () => setVisible(false);
    return visible ? React.createElement(First, { ref: firstRef }) : null;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        React.createElement(
          Outer,
          { ref: outerRef },
          React.createElement(FirstSlot),
          React.createElement(Second, { ref: fallbackRef })
        )
      )
    );
    [firstNode] = [...host.querySelectorAll('button')];
    const fallback = [...host.querySelectorAll('button')][1]!;
    firstNode!.addEventListener('focus', () =>
      timeline.push({ phase: 'old-focus', connected: firstNode!.isConnected })
    );
    let trustedFallbackFocusEvents = 0;
    fallback.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFallbackFocusEvents++;
    });
    request = true;
    await act(async () => {
      if (mode === 'retained-hide') firstRef.current.getExposes().hide();
      else terminalRemove();
    });
    await Promise.resolve();
    await Promise.resolve();
    return {
      timeline,
      fallbackActive: document.activeElement === fallback,
      fallbackFocused: fallbackRef.current.getExposes().focused.get(),
      oldConnected: firstNode!.isConnected,
      oldFocusEvents: timeline.filter((event) => event.phase === 'old-focus').length,
      trustedFallbackFocusEvents,
    };
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}
