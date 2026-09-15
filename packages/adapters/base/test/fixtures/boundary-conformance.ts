import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype, type BoundaryHandle } from '@proto.ui/core';
import { asBoundary } from '@proto.ui/hooks';

export type BoundaryTree = { proto: Prototype; children?: BoundaryTree[] };
export type BoundaryMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  press(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

export function boundaryAdapterConformance(
  name: string,
  mount: (tree: BoundaryTree[]) => Promise<BoundaryMount>
) {
  describe(`${name}: Boundary classification and sample ownership`, () => {
    it('T-BOUNDARY-0002-CASE-ADAPTER: preserves unknown and disjoint regions through the real Event transport', async () => {
      let boundary!: BoundaryHandle;
      let outside = 0;
      const extra = document.createElement('button');
      document.body.append(extra);
      const proto = definePrototype({
        name: `boundary-regions-${name}-catalog`,
        setup() {
          boundary = asBoundary();
          boundary.observe('pointer.press');
          boundary.observe('pointer.press');
          boundary.registerRegion(extra);
          boundary.subscribeOutside(() => {
            outside++;
          });
          return (r) => r.el('span', 'inside');
        },
      });
      const mounted = await mount([{ proto }]);
      try {
        await mounted.flush();
        const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
        expect(boundary.classify({ target: root.firstChild })).toBe('inside');
        expect(boundary.classify({ target: extra })).toBe('inside');
        expect(boundary.classify({ target: {} })).toBe('unknown');
        await mounted.press(extra);
        expect(outside).toBe(0);
        await mounted.press(document.body);
        expect(outside).toBe(1);
        const removeUnknown = boundary.registerRegion({});
        await mounted.press(document.body);
        expect(outside).toBe(1);
        removeUnknown();
        await mounted.press(document.body);
        expect(outside).toBe(2);
      } finally {
        await mounted.unmount();
        extra.remove();
      }
      await mounted.press(document.body);
      expect(outside).toBe(2);
    });

    it.each([false, true])(
      'T-BOUNDARY-0002-CASE-STACK: closing the top boundary retains sample ownership (reverse=%s)',
      async (reverse) => {
        const handles: BoundaryHandle[] = [];
        const outside = [0, 0];
        const protos = [0, 1].map((index) =>
          definePrototype({
            name: `boundary-stack-${name}-catalog-${Number(reverse)}-${index}`,
            setup() {
              const boundary = (handles[index] = asBoundary());
              boundary.observe('pointer.press');
              boundary.subscribeOutside(() => {
                outside[index]++;
                boundary.setStackActive(false);
              });
              return (r) => r.el('span', String(index));
            },
          })
        );
        // Exercise both host listener registration orders.
        if (reverse) protos.reverse();
        const mounted = await mount(protos.map((proto) => ({ proto })));
        try {
          await mounted.flush();
          handles[1].setStackActive(true);
          handles[0].setStackActive(true);
          await mounted.press(document.body);
          expect(outside).toEqual([1, 0]);
          await mounted.press(document.body);
          expect(outside[1]).toBe(1);
        } finally {
          await mounted.unmount();
        }
      }
    );
  });
}
