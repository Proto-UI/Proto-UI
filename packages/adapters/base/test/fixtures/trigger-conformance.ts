import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asTrigger } from '@proto.ui/hooks';

export type TriggerTree = { proto: Prototype; children?: TriggerTree[] };
export type TriggerMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

export function triggerAdapterConformance(
  name: string,
  mount: (tree: TriggerTree[]) => Promise<TriggerMount>
) {
  describe(`${name}: Trigger group translation`, () => {
    it('T-AS-TRIGGER-0002-CASE-ADAPTER: shares a three-member route and preserves host-local events across fresh owners', async () => {
      const semantic = [0, 0, 0];
      const local = [0, 0, 0];
      const protos = semantic.map((_, index) =>
        definePrototype({
          name: `trigger-${name}-catalog-${index}`,
          setup(def) {
            asTrigger();
            def.event.on('press.commit', () => {
              semantic[index]++;
            });
            def.event.on('host:catalog-local', () => {
              local[index]++;
            });
            return (r) => r.slot();
          },
        })
      );
      for (let generation = 0; generation < 2; generation++) {
        const mounted = await mount([
          { proto: protos[0], children: [{ proto: protos[1], children: [{ proto: protos[2] }] }] },
        ]);
        let roots: HTMLElement[] = [];
        try {
          await mounted.flush();
          roots = Array.from(mounted.host.querySelectorAll<HTMLElement>('[data-pui-root]'));
          expect(roots).toHaveLength(3);
          const before = [...semantic];
          await mounted.click(roots[0]);
          await mounted.click(roots[1]);
          await mounted.flush();
          expect(semantic).toEqual(before);
          await mounted.click(roots[2]);
          await mounted.flush();
          expect(semantic).toEqual(before.map((n) => n + 1));
          for (let i = 0; i < 3; i++) {
            const previous = [...local];
            roots[i].dispatchEvent(new CustomEvent('catalog-local', { bubbles: false }));
            expect(local).toEqual(previous.map((n, j) => n + Number(i === j)));
          }
        } finally {
          await mounted.unmount();
        }
        const after = [...semantic];
        await mounted.click(roots[2]);
        expect(semantic).toEqual(after);
      }
    });
  });
}
