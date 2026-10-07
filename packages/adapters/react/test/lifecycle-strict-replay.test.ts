import { asFocusable, asFocusEntry } from '@proto.ui/hooks';
import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createMountedReactAdapter } from './utils/fake-react';

describe('adapter-react: StrictMode lifecycle replay', () => {
  it('replays view epochs without disposing or recreating the Proto instance', async () => {
    const calls = { setup: 0, created: 0, mounted: 0, unmounted: 0, disposed: 0 };
    const proto = definePrototype({
      name: 'react-strict-view-epoch-replay',
      setup(def) {
        calls.setup += 1;
        def.lifecycle.onCreated(() => (calls.created += 1));
        def.lifecycle.onMounted(() => (calls.mounted += 1));
        def.lifecycle.onUnmounted(() => (calls.unmounted += 1));
        def.lifecycle.onBeforeDispose(() => (calls.disposed += 1));
        return (run) => run.el('div', 'ok');
      },
    });

    const mounted = createMountedReactAdapter(proto);
    expect(calls).toEqual({ setup: 1, created: 1, mounted: 1, unmounted: 0, disposed: 0 });

    mounted.replayLayoutEffects();
    await Promise.resolve();

    expect(calls).toEqual({ setup: 1, created: 1, mounted: 2, unmounted: 1, disposed: 0 });

    mounted.unmount();
    await Promise.resolve();
    expect(calls).toEqual({ setup: 1, created: 1, mounted: 2, unmounted: 2, disposed: 1 });
  });
});

// Controlled React runtime replay, not a native StrictMode scheduling claim.
it.each(['entry', 'native', 'programmatic'] as const)(
  'retains the exhausted %s allowance when layout effects replay',
  async (kind) => {
    let setups = 0;
    const proto = definePrototype({
      name: `react-replay-budget-${kind}`,
      setup(def) {
        setups++;
        const target = asFocusable(),
          entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('request', () => {
          if (kind === 'entry') entry.focus();
          else if (kind === 'native') target.focusSelf();
          else target.focus();
        });
        return (r) => r.el('button', 'Target');
      },
    });
    const mounted = createMountedReactAdapter(proto),
      frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    let attempts = 0;
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {
      attempts++;
    });
    const drain = async () => {
      for (let i = 0; frames.length && i < 12; i++) {
        const callbacks = frames.splice(0);
        callbacks.forEach((cb) => cb(performance.now()));
        await Promise.resolve();
      }
      expect(frames).toHaveLength(0);
    };
    try {
      mounted.ref.current.getExposes().request();
      await drain();
      expect(attempts).toBe(4);
      for (let cycle = 0; cycle < 3; cycle++) {
        mounted.replayLayoutEffects();
        await Promise.resolve();
        const before = attempts;
        await drain();
        expect(attempts).toBe(before);
        expect(setups).toBe(1);
      }
      attempts = 0;
      mounted.ref.current.getExposes().request();
      await drain();
      expect(attempts).toBe(4);
    } finally {
      focus.mockRestore();
      raf.mockRestore();
      mounted.unmount();
      await Promise.resolve();
    }
  }
);
