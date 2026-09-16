import { expect, it } from 'vitest';
import { definePrototype, type Prototype, type ScrollSurfaceHandle } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
export type ScrollTree = { proto: Prototype; children?: ScrollTree[] };
export type ScrollMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  unmount(): Promise<void>;
  dispatch(target: EventTarget, event: Event): Promise<void>;
};
export function scrollCatalogConformance(
  name: string,
  mount: (tree: ScrollTree[]) => Promise<ScrollMount>
) {
  it(`T-SCROLL-0001-CASE-ADAPTER: ${name} projects requests and current facts and cleans up the view`, async () => {
    let surface!: ScrollSurfaceHandle;
    let changes = 0;
    const proto = definePrototype({
      name: `scroll-catalog-${name}`,
      setup(def) {
        surface = asScrollSurface();
        surface.configure({ axes: 'vertical', projection: 'system' });
        surface.vertical.position.watch(() => {
          changes++;
        });
        def.event.on('host:scroll-request', () =>
          surface.request({ kind: 'to', axis: 'vertical', position: 0.5 })
        );
        return (r) => r.el('div', 'content');
      },
    });
    const m = await mount([{ proto }]);
    let unmounted = false;
    try {
      await m.flush();
      const el = m.host.querySelector<HTMLElement>('[data-pui-root]')!;
      Object.defineProperties(el, {
        clientHeight: { configurable: true, value: 200 },
        scrollHeight: { configurable: true, value: 1000 },
        clientWidth: { configurable: true, value: 100 },
        scrollWidth: { configurable: true, value: 100 },
        scrollTop: { configurable: true, value: 0, writable: true },
        scrollLeft: { configurable: true, value: 0, writable: true },
      });
      await m.dispatch(el, new Event('scroll'));
      await m.flush();
      expect(el.dataset.puiScrollProjection).toBe('system');
      expect(surface.vertical.visibleRatio.get()).toBe(0.2);
      await m.dispatch(el, new Event('scroll-request'));
      await m.flush();
      expect(el.scrollTop).toBe(400);
      expect(surface.vertical.position.get()).toBe(0.5);
      await m.unmount();
      unmounted = true;
      expect(el.hasAttribute('data-pui-scroll-projection')).toBe(false);
      const beforeLateEvent = changes;
      el.scrollTop = 800;
      el.dispatchEvent(new Event('scroll'));
      expect(changes).toBe(beforeLateEvent);
    } finally {
      if (!unmounted) await m.unmount();
    }
  });
}
