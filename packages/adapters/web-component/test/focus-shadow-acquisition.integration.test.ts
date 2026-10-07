import { AdaptToWebComponent } from '../src';
import { focusShadowAcquisitionConformance } from '../../base/test/fixtures/focus-shadow-acquisition-conformance';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
focusShadowAcquisitionConformance('wc', async (proto, container) => {
  AdaptToWebComponent(proto);
  const root: any = document.createElement(proto.name);
  container.append(root);
  await flush();
  return {
    root,
    request: () => root.getExposes().request(),
    flush,
    unmount: async () => {
      root.remove();
      await flush();
    },
  };
});

import { definePrototype } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { expect, it, vi } from 'vitest';
for (const lineMode of ['single', 'multiline'] as const) {
  for (const kind of ['programmatic', 'native', 'entry'] as const) {
    it(`accepts WC shadow text-control ${lineMode} ${kind} focus without pending retries`, async () => {
      const proto = definePrototype({
        name: `wc-shadow-control-${lineMode}-${kind}`,
        modules: [declareTextControl({ content: 'plain-text', lineMode, engine: 'host' })],
        setup(def) {
          asTextControl();
          const target = asFocusable(),
            entry = asFocusEntry();
          entry.configure({ strategy: 'self', fallback: 'self' });
          def.expose.method('request', () => {
            if (kind === 'native') target.focusSelf({ preventScroll: true });
            else if (kind === 'entry') entry.focus({ preventScroll: true });
            else target.focus({ preventScroll: true });
          });
          return () => null;
        },
      });
      AdaptToWebComponent(proto, { shadow: true });
      const host: any = document.createElement(proto.name);
      document.body.append(host);
      await flush();
      const target = host.shadowRoot.querySelector('input,textarea') as HTMLElement;
      expect(target).not.toBeNull();
      const frames: FrameRequestCallback[] = [];
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
        frames.push(fn);
        return frames.length;
      });
      const focus = vi.spyOn(target, 'focus');
      try {
        host.getExposes().request();
        await flush();
        expect(document.activeElement).toBe(host);
        expect(host.shadowRoot.activeElement).toBe(target);
        for (let i = 0; frames.length && i < 12; i++) {
          frames.splice(0).forEach((fn) => fn(performance.now()));
          await flush();
        }
        expect(frames).toHaveLength(0);
        expect(focus.mock.calls).toEqual([[{ preventScroll: true }]]);
      } finally {
        focus.mockRestore();
        raf.mockRestore();
        host.remove();
        await flush();
      }
    });
  }
}
