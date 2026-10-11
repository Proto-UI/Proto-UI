import { describe, expect, it } from 'vitest';
import { createContextKey, definePrototype, type Prototype, type RunHandle } from '@proto.ui/core';
import { CONTEXT_CENTER } from '../../src/center';

export type ContextTree = { proto: Prototype; children?: ContextTree[] };
type Mount = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

// Runtime/Adapter execution, not a DOM ancestry emulation: every intermediate
// owner provides the same key and explicitly derives its value from its parent.
export function ancestorConformance(name: string, mount: (tree: ContextTree[]) => Promise<Mount>) {
  describe(`${name}: strict ancestor Context through real Runtime owners`, () => {
    it('composes nested same-key providers, projects updates and isolates terminal generations', async () => {
      const key = createContextKey<{ value: number }>(`ancestor-${name}`);
      const transitions: number[] = [];
      const reads = new Map<string, number | null>();
      const provider = (label: string, local: number) =>
        definePrototype({
          name: `ancestor-${name}-${label}`,
          setup(def) {
            def.context.provide(key, { value: local });
            def.context.subscribe(key, (run) => run.update());
            const sync = (run: RunHandle<Record<string, unknown>>) => {
              const ancestor = run.context.tryReadAncestor(key);
              reads.set(label, ancestor?.value ?? null);
              run.context.update(key, { value: local + (ancestor?.value ?? 0) });
            };
            def.context.trySubscribeAncestor(key, sync);
            def.lifecycle.onMounted(sync);
            return (r) => [r.el('span', `${label}=${r.read.context.read(key).value}`), r.slot()];
          },
        });
      const outer = provider('outer', 1),
        middle = provider('middle', 10),
        inner = provider('inner', 100);
      const leaf = definePrototype({
        name: `ancestor-${name}-leaf`,
        setup(def) {
          def.context.subscribe(key, (run, next) => {
            transitions.push(next.value);
            run.update();
          });
          return (r) => r.el('span', `leaf=${r.read.context.read(key).value}`);
        },
      });
      const request = definePrototype({
        name: `ancestor-${name}-request`,
        setup(def) {
          def.context.subscribe(key);
          def.event.on('press.commit', (run) =>
            run.context.update(key, (prev) => ({ value: prev.value + 1 }))
          );
          return (r) => r.el('span', 'Request');
        },
      });
      const tree = [
        {
          proto: outer,
          children: [
            { proto: middle, children: [{ proto: inner, children: [{ proto: leaf }] }] },
            { proto: request },
          ],
        },
      ];
      for (let generation = 0; generation < 2; generation++) {
        const mounted = await mount(tree);
        try {
          await mounted.flush();
          const read = (label: string) =>
            Array.from(mounted.host.querySelectorAll('span')).find((el) =>
              el.textContent?.startsWith(`${label}=`)
            )?.textContent;
          expect(read('outer')).toBe('outer=1');
          expect(read('middle')).toBe('middle=11');
          expect(read('inner')).toBe('inner=111');
          expect(read('leaf')).toBe('leaf=111');
          expect(reads.get('outer')).toBeNull();
          expect(reads.get('inner')).toBe(11);
          transitions.length = 0;
          const target = Array.from(mounted.host.querySelectorAll('span'))
            .find((el) => el.textContent === 'Request')!
            .closest<HTMLElement>('[data-pui-root]')!;
          await mounted.click(target);
          await mounted.flush();
          expect(read('outer')).toBe('outer=2');
          expect(read('middle')).toBe('middle=12');
          expect(read('inner')).toBe('inner=112');
          expect(read('leaf')).toBe('leaf=112');
          expect(transitions).toEqual([112]);
          expect(reads.get('inner')).toBe(12);
        } finally {
          await mounted.unmount();
        }
        expect(CONTEXT_CENTER.dumpProviders().filter((row) => row.key === key)).toEqual([]);
        expect(CONTEXT_CENTER.dumpSubscriptions().filter((row) => row.key === key)).toEqual([]);
      }
    });
  });
}
