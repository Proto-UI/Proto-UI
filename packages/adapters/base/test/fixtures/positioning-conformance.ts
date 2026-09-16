import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
export type PositioningTree = { proto: Prototype; children?: PositioningTree[] };
export type PositioningMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  unmount(): Promise<void>;
  dispatch(target: EventTarget, event: Event): Promise<void>;
};
export function positioningAdapterConformance(
  name: string,
  mount: (tree: PositioningTree[]) => Promise<PositioningMount>
) {
  describe(`${name}: anchored positioning`, () => {
    it('T-ANCHORED-POSITIONING-0001-CASE-ADAPTER: projects geometry only during the active Overlay connection', async () => {
      const anchor = document.createElement('button'),
        floating = document.createElement('div');
      let x = 100;
      anchor.getBoundingClientRect = () => ({
        x,
        y: 100,
        top: 100,
        left: x,
        right: x + 50,
        bottom: 120,
        width: 50,
        height: 20,
        toJSON: () => ({}),
      });
      floating.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 40,
        bottom: 10,
        width: 40,
        height: 10,
        toJSON: () => ({}),
      });
      Object.defineProperties(anchor, { offsetWidth: { value: 50 }, offsetHeight: { value: 20 } });
      Object.defineProperties(floating, {
        offsetWidth: { value: 40 },
        offsetHeight: { value: 10 },
      });
      floating.style.transform = 'scale(0.9)';
      document.body.append(anchor, floating);
      const proto = definePrototype({
        name: `positioning-${name}-catalog`,
        setup(def) {
          const overlay = asOverlay();
          overlay.configure({
            anchored: true,
            defaultOpen: true,
            placement: 'bottom',
            align: 'start',
            sideOffset: 4,
            avoidCollisions: false,
            strategy: 'fixed',
          });
          def.lifecycle.onMounted(() => {
            overlay.registerAnchor(anchor);
            overlay.registerContent(floating);
          });
          def.event.on('host:catalog-close', () => overlay.close('programmatic'));
          return (r) => r.el('span', 'anchored');
        },
      });
      const mounted = await mount([{ proto }]);
      const flush = async () => {
        await mounted.flush();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await mounted.flush();
      };
      try {
        await flush();
        expect(floating.style.left).toBe('100px');
        expect(floating.style.top).toBe('124px');
        expect(floating.dataset).toMatchObject({ side: 'bottom', align: 'start' });
        expect(floating.style.transform).toBe('scale(0.9)');
        const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
        x = 150;
        window.dispatchEvent(new Event('resize'));
        await flush();
        expect(floating.style.left).toBe('150px');
        await mounted.dispatch(root, new Event('catalog-close'));
        await flush();
        x = 200;
        window.dispatchEvent(new Event('resize'));
        await flush();
        expect(floating.style.left).toBe('150px');
      } finally {
        await mounted.unmount();
        const before = floating.style.cssText;
        x = 300;
        window.dispatchEvent(new Event('resize'));
        await flush();
        expect(floating.style.cssText).toBe(before);
        anchor.remove();
        floating.remove();
      }
    });
  });
}
