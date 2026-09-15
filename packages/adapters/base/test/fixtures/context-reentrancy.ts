import { describe, expect, it } from 'vitest';
import { createContextKey, definePrototype, type Prototype } from '@proto.ui/core';
import { CONTEXT_CENTER } from '../../../../modules/context/src/center';

export type ContextTree = { proto: Prototype; children?: ContextTree[] };
type Mount = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

// Actual framework owners and Runtime callback scopes. The first subscriber
// echoes a request while the second still has the earlier notification pending.
export function contextReentrancyConformance(
  name: string,
  mount: (tree: ContextTree[]) => Promise<Mount>
) {
  describe(`${name}: J1 reentrant Context projection`, () => {
    it('renders the latest derived state and retains every transition across new owner generations', async () => {
      const key = createContextKey<{ value: number }>(`j1-${name}`);
      const transitions: number[] = [];
      const root = definePrototype({
        name: `j1-${name}-root`,
        setup(def) {
          def.context.provide(key, { value: 0 });
          return (r) => r.slot();
        },
      });
      const first = definePrototype({
        name: `j1-${name}-first`,
        setup(def) {
          def.context.subscribe(key, (run, next) => {
            if (next.value === 1) run.context.update(key, { value: 2 });
          });
          def.event.on('press.commit', (run) => run.context.update(key, { value: 1 }));
          return (r) => r.el('span', 'Request');
        },
      });
      const last = definePrototype({
        name: `j1-${name}-last`,
        setup(def) {
          let observed = 0;
          def.context.subscribe(key, (run, next) => {
            observed = next.value;
            transitions.push(observed);
            run.update();
          });
          return (r) => r.el('span', `Observed ${observed}`);
        },
      });
      for (let generation = 0; generation < 2; generation++) {
        transitions.length = 0;
        const mounted = await mount([
          { proto: root, children: [{ proto: first }, { proto: last }] },
        ]);
        try {
          await mounted.flush();
          const request = Array.from(mounted.host.querySelectorAll('span'))
            .find((el) => el.textContent === 'Request')!
            .closest<HTMLElement>('[data-pui-root]')!;
          await mounted.click(request);
          await mounted.flush();
          expect(transitions).toEqual([1, 2]);
          expect(mounted.host.textContent).toContain('Observed 2');
          expect(CONTEXT_CENTER.dumpCallbackQueue()).toEqual([]);
        } finally {
          await mounted.unmount();
        }
        expect(CONTEXT_CENTER.dumpProviders().filter((p) => p.key === key)).toEqual([]);
        expect(CONTEXT_CENTER.dumpSubscriptions().filter((p) => p.key === key)).toEqual([]);
      }
    });
  });
}
