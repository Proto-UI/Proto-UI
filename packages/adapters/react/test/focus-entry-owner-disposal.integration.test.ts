import { expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createReactAdapter } from '../src';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it.each(['retained-hide', 'terminal-unmount'] as const)(
  'entry requested during ordinary React owner teardown: %s',
  async (mode) => {
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
      setup() {
        asFocusable();
        return () => 'fallback';
      },
    });
    const adapt = createReactAdapter(React),
      Outer = adapt(outerProto),
      First = adapt(firstProto, { rootTag: 'button' }),
      Second = adapt(secondProto, { rootTag: 'button' });
    const outerRef = React.createRef<any>(),
      firstRef = React.createRef<any>();
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
            React.createElement(Second)
          )
        )
      );
      [firstNode] = [...host.querySelectorAll('button')];
      const fallback = [...host.querySelectorAll('button')][1]!;
      firstNode!.addEventListener('focus', () =>
        timeline.push({ phase: 'old-focus', connected: firstNode!.isConnected })
      );
      request = true;
      await act(async () => {
        if (mode === 'retained-hide') firstRef.current.getExposes().hide();
        else terminalRemove();
      });
      await Promise.resolve();
      await Promise.resolve();
      console.info('real ordinary disappearance', {
        mode,
        timeline,
        fallbackActive: document.activeElement === fallback,
        oldConnected: firstNode!.isConnected,
      });
      expect(timeline.some((event) => event.phase === 'old-focus')).toBe(false);
      expect(firstNode!.isConnected).toBe(false);
      expect(document.activeElement).toBe(fallback);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  }
);
