import { describe, expect, it } from 'vitest';
import { createContextKey, definePrototype, type Prototype } from '@proto.ui/core';

export type ContextTree = { proto: Prototype; children?: ContextTree[] };
export type ContextMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

// C-CONTEXT-0003/0004/0006/0007/0010/0012. Each driver mounts real
// framework owners; only host composition differs, never Context semantics.
export function contextAdapterConformance(
  name: string,
  mount: (tree: ContextTree[]) => Promise<ContextMount>
) {
  describe(`${name}: Context owner and ancestry translation`, () => {
    it('T-CONTEXT-0003-CASE-ADAPTER: resolves nested scopes and isolates fresh owners after teardown', async () => {
      const key = createContextKey<{ value: number }>('shared-context');
      const otherKey = createContextKey<{ value: number }>('shared-context');
      const transitions: Array<[string, number, number]> = [];
      let setupCount = 0;
      const proto = (label: string, initial?: number, optional = false) =>
        definePrototype({
          name: `context-${name}-${label}`,
          setup(def) {
            setupCount++;
            if (initial !== undefined) def.context.provide(key, { value: initial });
            const changed = (
              run: { update(): void },
              next: { value: number } | null,
              prev: { value: number } | null
            ) => {
              if (next && prev) transitions.push([label, prev.value, next.value]);
              run.update();
            };
            if (optional) def.context.trySubscribe(key, changed);
            else def.context.subscribe(key, changed);
            // Equal debug names never merge ContextKey identity.
            def.context.trySubscribe(otherKey);
            if (initial === undefined)
              def.event.on('press.commit', (run) => {
                if (optional) run.context.tryUpdate(key, (prev) => ({ value: prev.value + 1 }));
                else run.context.update(key, (prev) => ({ value: prev.value + 1 }));
              });
            return (r) => {
              const value = optional ? r.read.context.tryRead(key) : r.read.context.read(key);
              const other = r.read.context.tryRead(otherKey);
              return [
                r.el(
                  'span',
                  `${label}=${value?.value ?? 'absent'}:${other === null ? 'isolated' : 'leaked'}`
                ),
                r.slot(),
              ];
            };
          },
        });
      const outer = proto('outer', 1);
      const inner = proto('inner', 10);
      const leaf = proto('leaf');
      const sibling = proto('sibling');
      const orphan = proto('orphan', undefined, true);
      const tree = [
        {
          proto: outer,
          children: [{ proto: inner, children: [{ proto: leaf }] }, { proto: sibling }],
        },
        { proto: orphan },
      ];
      for (let generation = 0; generation < 2; generation++) {
        const mounted = await mount(tree);
        const read = (label: string) =>
          Array.from(mounted.host.querySelectorAll('span')).find((el) =>
            el.textContent?.startsWith(`${label}=`)
          );
        const activate = async (label: string) => {
          const root = read(label)?.closest<HTMLElement>('[data-pui-root]');
          if (!root) throw new Error(`Missing ${label} owner`);
          await mounted.click(root);
          await mounted.flush();
        };
        try {
          await mounted.flush();
          expect(setupCount).toBe((generation + 1) * 5);
          expect(read('outer')?.textContent?.split('=')[1]).toBe('1:isolated');
          expect(read('inner')?.textContent?.split('=')[1]).toBe('10:isolated');
          expect(read('leaf')?.textContent?.split('=')[1]).toBe('10:isolated');
          expect(read('sibling')?.textContent?.split('=')[1]).toBe('1:isolated');
          expect(read('orphan')?.textContent?.split('=')[1]).toBe('absent:isolated');
          transitions.length = 0;
          await activate('leaf');
          expect(read('leaf')?.textContent?.split('=')[1]).toBe('11:isolated');
          expect(read('inner')?.textContent?.split('=')[1]).toBe('11:isolated');
          expect(read('outer')?.textContent?.split('=')[1]).toBe('1:isolated');
          expect(transitions).toEqual([
            ['inner', 10, 11],
            ['leaf', 10, 11],
          ]);
          transitions.length = 0;
          await activate('sibling');
          expect(read('outer')?.textContent?.split('=')[1]).toBe('2:isolated');
          expect(read('sibling')?.textContent?.split('=')[1]).toBe('2:isolated');
          expect(read('inner')?.textContent?.split('=')[1]).toBe('11:isolated');
          expect(transitions).toEqual([
            ['outer', 1, 2],
            ['sibling', 1, 2],
          ]);
          transitions.length = 0;
          await activate('orphan');
          expect(transitions).toEqual([]);
          expect(read('orphan')?.textContent?.split('=')[1]).toBe('absent:isolated');
        } finally {
          await mounted.unmount();
        }
      }
    });
  });
}
