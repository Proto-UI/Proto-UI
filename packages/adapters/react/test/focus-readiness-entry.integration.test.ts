import { expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createReactAdapter } from '../src';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it('real React preserves descendant entry focus requested in onMounted', async () => {
  const proto = definePrototype({
    name: 'independent-real-entry-ready-control',
    setup(def) {
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.lifecycle.onMounted(() => entry.focus());
      return (r) => r.el('button', 'native descendant');
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const Component = createReactAdapter(React)(proto);
  try {
    await act(async () => root.render(React.createElement(Component)));
    expect(document.activeElement).toBe(host.querySelector('button'));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
it('real React preserves descendant entry focus requested in onUpdated', async () => {
  let enterOnUpdate = false;
  let calls = 0;
  const proto = definePrototype({
    name: 'independent-real-entry-update-control',
    setup(def) {
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.lifecycle.onUpdated(() => {
        if (enterOnUpdate) {
          calls++;
          entry.focus();
        }
      });
      return (r) => r.el('button', 'native descendant');
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  const Component = createReactAdapter(React)(proto);
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    enterOnUpdate = true;
    await act(async () => ref.current.update());
    expect(calls).toBeGreaterThan(0);
    expect(document.activeElement).toBe(host.querySelector('button'));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
it('real React preserves pending entry when onUpdated disables the dual-role target', async () => {
  let enterOnUpdate = false;
  let calls = 0;
  const proto = definePrototype({
    name: 'real-entry-update-target-disable',
    setup(def) {
      const entry = asFocusEntry();
      const focusable = asFocusable();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.expose.state('focused', focusable.focused);
      def.lifecycle.onUpdated(() => {
        if (!enterOnUpdate) return;
        enterOnUpdate = false;
        calls++;
        entry.focus({ reason: 'keyboard', preventScroll: true });
        focusable.setDisabled(true);
      });
      return (r) => r.el('button', 'enabled descendant');
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  const Component = createReactAdapter(React)(proto);
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    const target = host.querySelector<HTMLElement>('[data-pui-root]')!;
    await act(async () => target.focus());
    expect(document.activeElement).toBe(target);
    expect(ref.current.getExposes().focused.get()).toBe(true);
    enterOnUpdate = true;
    await act(async () => ref.current.update());
    expect(calls).toBe(1);
    expect(document.activeElement).toBe(host.querySelector('button'));
    expect(ref.current.getExposes().focused.get()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
