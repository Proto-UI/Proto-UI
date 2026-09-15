import { describe, expect, it } from 'vitest';
import {
  createAnatomyFamily,
  definePrototype,
  type Prototype,
  type RunHandle,
} from '@proto.ui/core';
export type AnatomyTree = { proto: Prototype; children?: AnatomyTree[] };
export type AnatomyMount = {
  host: HTMLElement;
  flush(action?: () => void): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};
export function anatomyAdapterConformance(
  name: string,
  mount: (tree: AnatomyTree[]) => Promise<AnatomyMount>
) {
  describe(`${name}: Anatomy translation`, () => {
    it('T-ANATOMY-0004-CASE-ADAPTER: isolates nested domains, projects host order and invokes target-owned exposed methods', async () => {
      const family = createAnatomyFamily('adapter-anatomy', {
        roles: {
          root: { cardinality: { min: 1, max: 1 } },
          item: { cardinality: { min: 0, max: '*' } },
        },
      });
      const sameName = createAnatomyFamily('adapter-anatomy', family.decl);
      const reads = new Map<string, RunHandle<Record<string, unknown>>>();
      const calls: string[] = [];
      const proto = (label: string, role: 'root' | 'item') =>
        definePrototype({
          name: `anatomy-${name}-${label}`,
          setup(def) {
            def.anatomy.claim(family, { role });
            def.expose.value('label', label);
            const count = def.state.bool('count', false);
            def.expose.method('bump', () => {
              count.set(true);
              calls.push(label);
            });
            def.lifecycle.onMounted((run) => {
              reads.set(label, run);
            });
            def.event.on('press.commit', (run) => {
              if (role === 'root')
                for (const part of run.anatomy.order.partsOf(family, 'item'))
                  (part.getExpose('bump') as () => void)();
              run.update();
            });
            return (r) => [r.el('span', `${label}:${Number(count.get())}`), r.slot()];
          },
        });
      const outer = proto('outer', 'root'),
        inner = proto('inner', 'root'),
        a = proto('a', 'item'),
        b = proto('b', 'item'),
        c = proto('c', 'item');
      const tree = [
        {
          proto: outer,
          children: [{ proto: b }, { proto: inner, children: [{ proto: c }] }, { proto: a }],
        },
      ];
      for (let generation = 0; generation < 2; generation++) {
        const view = await mount(tree);
        try {
          await view.flush();
          const parts = (label: string) => reads.get(label)!.anatomy.order.partsOf(family, 'item');
          expect(parts('outer').map((p) => p.getExpose('label'))).toEqual(['b', 'a']);
          expect(parts('inner').map((p) => p.getExpose('label'))).toEqual(['c']);
          expect(parts('c').map((p) => p.getExpose('label'))).toEqual(['c']);
          expect(reads.get('a')!.anatomy.order.indexOfSelf(family, 'item')).toBe(1);
          expect(reads.get('a')!.anatomy.order.prevOfSelf(family, 'item')?.getExpose('label')).toBe(
            'b'
          );
          expect(() => reads.get('outer')!.anatomy.parts(sameName)).toThrow();
          expect(Object.keys(parts('outer')[0]).sort()).toEqual([
            'getExpose',
            'hasExpose',
            'hasHook',
            'role',
          ]);
          const label = (value: string) =>
            Array.from(view.host.querySelectorAll('span')).find((s) => s.textContent === value);
          expect(label('a:0')).toBeDefined();
          expect(label('c:0')).toBeDefined();
          calls.length = 0;
          await view.click(label('outer:0')!.closest<HTMLElement>('[data-pui-root]')!);
          await view.flush();
          expect(calls).toEqual(['b', 'a']);
          // Target methods mutate target State in the target callback scope.
          await view.flush(() => {
            reads.get('a')!.update();
            reads.get('b')!.update();
          });
          expect(label('a:1')).toBeDefined();
          expect(label('b:1')).toBeDefined();
          expect(label('c:0')).toBeDefined();
        } finally {
          await view.unmount();
        }
      }
    });
  });
}
