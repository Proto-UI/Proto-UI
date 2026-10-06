import { describe, expect, it, vi } from 'vitest';
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
    it('projects available-space only for the active opted-in view and releases its projection on close', async () => {
      const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
      const viewport = Object.assign(new EventTarget(), {
        width: 390,
        height: 800,
        offsetLeft: 0,
        offsetTop: 0,
      });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      const originalStyle = window.getComputedStyle.bind(window);
      const style = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
        const actual = originalStyle(element, pseudo);
        return element.hasAttribute('data-pui-available-space-probe')
          ? new Proxy(actual, {
              get(target, key) {
                return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].includes(
                  String(key)
                )
                  ? '0px'
                  : Reflect.get(target, key, target);
              },
            })
          : actual;
      });
      const floating = document.createElement('div');
      document.body.append(floating);
      const proto = definePrototype({
        name: `available-space-${name}-catalog`,
        setup(def) {
          const overlay = asOverlay();
          overlay.configure({ availableSpace: true, defaultOpen: true });
          def.lifecycle.onMounted(() => overlay.registerContent(floating));
          def.event.on('host:catalog-open', () => overlay.openOverlay('programmatic'));
          def.event.on('host:catalog-close', () => overlay.close('programmatic'));
          return (r) => r.el('span', 'available space');
        },
      });
      const mounted = await mount([{ proto }]);
      try {
        await mounted.flush();
        const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
        expect(floating.style.getPropertyValue('--proto-ui-available-region-width')).toBe('390px');
        viewport.height = 420;
        viewport.offsetTop = 60;
        viewport.dispatchEvent(new Event('resize'));
        await mounted.flush();
        expect(floating.style.getPropertyValue('--proto-ui-available-region-height')).toBe('420px');
        expect(floating.style.getPropertyValue('--proto-ui-available-region-center-y')).toBe(
          '270px'
        );
        await mounted.dispatch(root, new Event('catalog-close'));
        await mounted.flush();
        expect(floating.style.getPropertyValue('--proto-ui-available-region-height')).toBe('');
        viewport.height = 600;
        viewport.dispatchEvent(new Event('resize'));
        await mounted.flush();
        expect(floating.style.getPropertyValue('--proto-ui-available-region-height')).toBe('');
        expect(document.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(0);
      } finally {
        await mounted.unmount();
        floating.remove();
        style.mockRestore();
        if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
        else Reflect.deleteProperty(window, 'visualViewport');
      }
    });

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
