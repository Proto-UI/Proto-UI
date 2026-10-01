import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { definePrototype, type OwnedStateHandle } from '@proto.ui/core';
import type { RuntimeLifecycleEvent } from '@proto.ui/runtime';

import { createReactAdapter, type ReactAdapterHandle } from '../../src/adapt';

describe('contract: adapter-react / update epoch ownership (v1)', () => {
  it('updates the replacement epoch when same-turn Activity replay supersedes a pending commit', async () => {
    const trace: RuntimeLifecycleEvent[] = [];
    const calls = { setup: 0, created: 0, mounted: 0, unmounted: 0, updated: 0, disposed: 0 };
    let count!: OwnedStateHandle<number>;
    const proto = definePrototype({
      name: 'react-update-epoch-ownership',
      setup(def) {
        calls.setup += 1;
        count = def.state.numberDiscrete('count', 0);
        def.lifecycle.onCreated(() => (calls.created += 1));
        def.lifecycle.onMounted(() => (calls.mounted += 1));
        def.lifecycle.onUnmounted(() => (calls.unmounted += 1));
        def.lifecycle.onUpdated(() => (calls.updated += 1));
        def.lifecycle.onBeforeDispose(() => (calls.disposed += 1));
        return (renderer) => renderer.el('p', String(count.get()));
      },
    });

    const Component = createReactAdapter(React)(proto, {
      schedule: (task) => task(),
      autoUpdateOnPropsChange: false,
      diagnostics: { onLifecycleEvent: (event) => trace.push(event) },
    });
    const ref = React.createRef<ReactAdapterHandle>();
    let setMode!: (mode: 'visible' | 'hidden') => void;
    function App() {
      const [mode, changeMode] = React.useState<'visible' | 'hidden'>('visible');
      setMode = changeMode;
      return React.createElement(React.Activity, {
        mode,
        children: React.createElement(Component, { ref }),
      });
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() => root.render(React.createElement(App)));
    const state = count;
    const update = (value: number) => {
      const handle = ref.current!;
      handle.invokeInCallbackScope?.(() => count.set(value));
      handle.update();
    };

    try {
      expect(host.textContent).toBe('0');
      flushSync(() => {
        update(1);
        expect(trace.at(-1)).toEqual({ type: 'update.render', epoch: 1, revision: 1 });
        expect(host.textContent).toBe('0');
        setMode('hidden');
      });

      // Activity disconnects layout effects before the old update can commit.
      // Reconnect in the same turn to retain the existing Proto owner.
      expect(trace.at(-1)).toEqual({ type: 'unmount.done', epoch: 1 });
      flushSync(() => setMode('visible'));
      await Promise.resolve();
      expect(trace).toContainEqual({ type: 'mount.mounted', epoch: 2 });
      expect(host.textContent).toBe('1');
      expect(count).toBe(state);
      expect(calls).toEqual({
        setup: 1,
        created: 1,
        mounted: 2,
        unmounted: 1,
        updated: 0,
        disposed: 0,
      });

      flushSync(() => {
        update(2);
        expect(trace.at(-1)).toEqual({ type: 'update.render', epoch: 2, revision: 2 });
        expect(host.textContent).toBe('1');
        update(3);
        expect(trace.filter((event) => event.type === 'update.render')).toEqual([
          { type: 'update.render', epoch: 1, revision: 1 },
          { type: 'update.render', epoch: 2, revision: 2 },
        ]);
      });

      expect(host.textContent).toBe('3');
      expect(trace.filter((event) => event.type.startsWith('update.'))).toEqual([
        { type: 'update.render', epoch: 1, revision: 1 },
        { type: 'update.render', epoch: 2, revision: 2 },
        { type: 'update.commit.done', epoch: 2, revision: 2 },
        { type: 'update.updated', epoch: 2, revision: 2 },
        { type: 'update.render', epoch: 2, revision: 3 },
        { type: 'update.commit.done', epoch: 2, revision: 3 },
        { type: 'update.updated', epoch: 2, revision: 3 },
      ]);
      expect(calls.updated).toBe(2);
      expect(calls.setup).toBe(1);
      expect(calls.created).toBe(1);
    } finally {
      flushSync(() => root.unmount());
      host.remove();
    }

    await Promise.resolve();
    expect(calls.disposed).toBe(1);
  });
});
