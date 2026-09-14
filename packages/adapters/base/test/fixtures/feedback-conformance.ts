import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type Prototype } from '@proto.ui/core';

export type FeedbackTree = { proto: Prototype; children?: FeedbackTree[] };
export type FeedbackMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

export function feedbackAdapterConformance(
  name: string,
  mount: (tree: FeedbackTree[]) => Promise<FeedbackMount>
) {
  describe(`${name}: real Feedback style translation`, () => {
    it('T-FEEDBACK-0001-CASE-ADAPTER: patches over Rule, suppresses and clears without structural rendering', async () => {
      let renders = 0;
      let setups = 0;
      const proto = definePrototype({
        name: `feedback-${name}-catalog`,
        setup(def) {
          setups++;
          let step = 0;
          const active = def.state.bool('active', true);
          def.feedback.style.use(tw('opacity-25 bg-red-500 text-white'));
          def.rule({
            when: (w) => w.state(active).eq(true),
            intent: (i) => i.feedback.style.use(tw('opacity-50 bg-blue-500')),
          });
          def.event.on('press.commit', (run) => {
            switch (step++) {
              case 0:
                run.feedback.style.patch(tw('opacity-100'));
                break;
              case 1:
                run.feedback.style.suppress(tw('bg-blue-500'));
                break;
              case 2:
                active.set(false);
                break;
              default:
                run.feedback.style.clearPatch();
            }
          });
          return (r) => {
            renders++;
            return r.el('span', 'stable-content');
          };
        },
      });
      for (let generation = 0; generation < 2; generation++) {
        const mounted = await mount([{ proto }]);
        try {
          await mounted.flush();
          const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
          expect(root).toBeTruthy();
          const child = root.querySelector('span');
          const initialRenders = renders;
          expect(setups).toBe(generation + 1);
          const assertStyle = (tokens: string[]) => {
            expect(
              (root.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean).sort()
            ).toEqual([...tokens].sort());
            expect(root.classList.contains('user-feedback-class')).toBe(true);
            expect(root.classList.contains('opacity-100')).toBe(false);
            expect(root.querySelector('span')).toBe(child);
            expect(child?.textContent).toBe('stable-content');
            expect(renders).toBe(initialRenders);
          };
          assertStyle(['opacity-50', 'bg-blue-500', 'text-white']);
          for (const expected of [
            ['opacity-100', 'bg-blue-500', 'text-white'],
            ['opacity-100', 'text-white'],
            ['opacity-100', 'text-white'],
            ['opacity-25', 'bg-red-500', 'text-white'],
          ]) {
            await mounted.click(root);
            await mounted.flush();
            assertStyle(expected);
          }
        } finally {
          await mounted.unmount();
        }
      }
    });
  });
}
