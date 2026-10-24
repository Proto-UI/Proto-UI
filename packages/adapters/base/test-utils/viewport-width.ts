import { definePrototype, tw, type Prototype } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';
type Props = { enabled?: boolean; value?: number };
type Options = { autoUpdateOnPropsChange: false; getMeta?: (key: string) => unknown };
type Mounted = {
  host: HTMLElement;
  act(action: () => void): Promise<void>;
  setProps(props: Props, concurrent?: () => void): Promise<void>;
  setPresent(value: boolean): Promise<void>;
  update(): Promise<void>;
  unmount(): Promise<void>;
};
let serial = 0;
export function describeViewportWidthIntegration(
  adapter: string,
  mount: (proto: Prototype<Props>, options: Options) => Promise<Mounted>
) {
  describe(`${adapter} bounded viewport width Rule`, () => {
    it.each([false, true])(
      'keeps same surface and runtime state while resizing (custom=%s)',
      async (custom) => {
        const old = Object.getOwnPropertyDescriptor(window, 'innerWidth');
        Object.defineProperty(window, 'innerWidth', {
          configurable: true,
          writable: true,
          value: 767,
        });
        let renders = 0,
          setups = 0;
        const proto = definePrototype<Props>({
          name: `viewport-${adapter}-${++serial}`,
          setup(def) {
            setups++;
            def.feedback.style.use(tw('text-base'));
            def.rule({
              when: (w) => w.meta('viewport.width').gte(768),
              intent: (i) => i.feedback.style.use(tw('text-sm')),
            });
            return (r) => {
              renders++;
              return r.el('span', 'viewport');
            };
          },
        });
        let mounted: Mounted | undefined;
        try {
          mounted = await mount(proto, {
            autoUpdateOnPropsChange: false,
            ...(custom ? { getMeta: () => 999 } : {}),
          });
          await mounted.act(() => {});
          const surface =
            mounted.host.querySelector('[data-pui-root]') ?? mounted.host.firstElementChild!;
          const tokens = () => surface.getAttribute('data-pui-style') ?? '';
          expect(tokens()).toContain('text-base');
          const previousRenders = renders;
          await mounted.act(() => {
            Object.defineProperty(window, 'innerWidth', {
              configurable: true,
              writable: true,
              value: 768,
            });
            window.dispatchEvent(new Event('resize'));
          });
          expect(tokens()).toContain(custom ? 'text-base' : 'text-sm');
          expect(
            mounted.host.querySelector('[data-pui-root]') ?? mounted.host.firstElementChild
          ).toBe(surface);
          expect(setups).toBe(1);
          expect(renders).toBe(previousRenders);
          await mounted.act(() => {
            Object.defineProperty(window, 'innerWidth', {
              configurable: true,
              writable: true,
              value: 767.5,
            });
            window.dispatchEvent(new Event('resize'));
          });
          expect(tokens()).toContain('text-base');
          await mounted.unmount();
          mounted = undefined;
        } finally {
          await mounted?.unmount();
          if (old) Object.defineProperty(window, 'innerWidth', old);
        }
      }
    );
  });
}
