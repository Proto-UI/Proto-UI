import { expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';

type Mounted = {
  root: HTMLElement;
  request(): void;
  flush(): Promise<void>;
  unmount(): Promise<void>;
};
export function focusShadowAcquisitionConformance(
  adapter: string,
  mount: (proto: Prototype<any, any>, container: HTMLElement) => Promise<Mounted>
) {
  for (const mode of ['open', 'closed', 'nested'] as const) {
    for (const kind of ['programmatic', 'native', 'entry'] as const) {
      it(`accepts ${adapter} ${kind} acquisition in an owned ${mode} shadow tree`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        let shadow = host.attachShadow({ mode: mode === 'closed' ? 'closed' : 'open' });
        if (mode === 'nested') {
          const innerHost = document.createElement('div');
          shadow.append(innerHost);
          shadow = innerHost.attachShadow({ mode: 'closed' });
        }
        const container = document.createElement('div');
        shadow.append(container);
        const proto = definePrototype({
          name: `shadow-acquisition-${adapter}-${mode}-${kind}`,
          setup(def) {
            const target = asFocusable();
            const entry = asFocusEntry();
            entry.configure({ strategy: 'self', fallback: 'self' });
            def.expose.method('request', () => {
              const options = { reason: 'keyboard' as const, preventScroll: true };
              if (kind === 'entry') entry.focus(options);
              else if (kind === 'native') target.focusSelf(options);
              else target.focus(options);
            });
            return () => null;
          },
        });
        const mounted = await mount(proto, container);
        const frames: FrameRequestCallback[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
          frames.push(fn);
          return frames.length;
        });
        const focus = vi.spyOn(mounted.root, 'focus');
        try {
          mounted.request();
          await mounted.flush();
          expect(document.activeElement).toBe(host);
          expect(shadow.activeElement).toBe(mounted.root);
          for (let i = 0; frames.length && i < 12; i++) {
            frames.splice(0).forEach((fn) => fn(performance.now()));
            await mounted.flush();
          }
          expect(frames).toHaveLength(0);
          expect(focus.mock.calls).toEqual([[{ preventScroll: true }]]);
        } finally {
          focus.mockRestore();
          raf.mockRestore();
          await mounted.unmount();
          host.remove();
        }
      });
    }
  }
}
