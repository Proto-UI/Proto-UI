import * as tree from '../src/platform/instance-tree';
import { asFocusable, asFocusEntry } from '@proto.ui/hooks';
import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { focusIntentRetryConformance } from '../../base/test/fixtures/focus-intent-retry-conformance';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
focusIntentRetryConformance('wc', tree, async (proto) => {
  AdaptToWebComponent(proto);
  const root = document.createElement(proto.name) as HTMLElement & { getExposes(): any };
  document.body.append(root);
  await flush();
  return {
    root,
    getExposes: () => root.getExposes(),
    act: async (callback) => {
      callback();
      await flush();
    },
    unmount: async () => {
      root.remove();
      await flush();
    },
  };
});

it.each(['entry', 'native', 'programmatic'] as const)(
  'keeps the exhausted %s allowance through synchronous DOM moves',
  async (kind) => {
    let setups = 0;
    const proto = definePrototype({
      name: `wc-move-budget-${kind}`,
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
    AdaptToWebComponent(proto);
    const root: any = document.createElement(proto.name);
    document.body.append(root);
    await flush();
    const frames: FrameRequestCallback[] = [];
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
        await flush();
      }
      expect(frames).toHaveLength(0);
    };
    try {
      root.getExposes().request();
      await flush();
      await drain();
      expect(attempts).toBe(4);
      for (let cycle = 0; cycle < 3; cycle++) {
        root.remove();
        document.body.append(root);
        await flush();
        const before = attempts;
        await drain();
        expect(attempts).toBe(before);
        expect(setups).toBe(1);
      }
      attempts = 0;
      root.getExposes().request();
      await flush();
      await drain();
      expect(attempts).toBe(4);
    } finally {
      focus.mockRestore();
      raf.mockRestore();
      root.remove();
      await flush();
    }
  }
);
