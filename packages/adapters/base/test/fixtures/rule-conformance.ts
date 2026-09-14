import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type Prototype } from '@proto.ui/core';

export type RuleProps = { active?: boolean };
export type RuleMount = {
  host: HTMLElement;
  setProps(props: RuleProps): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  flush(): Promise<void>;
  unmount(): Promise<void>;
};
export function ruleAdapterConformance(
  name: string,
  mount: (proto: Prototype<RuleProps>) => Promise<RuleMount>
) {
  describe(`${name}: Rule core translation`, () => {
    it('T-RULE-0002-CASE-ADAPTER: resolves props and current state, removes contributions and preserves owner isolation', async () => {
      let renders = 0,
        setups = 0;
      const proto = definePrototype<RuleProps>({
        name: `rule-${name}-catalog`,
        setup(def) {
          setups++;
          def.props.define({ active: { type: 'boolean', default: false } });
          const selected = def.state.bool('selected', false);
          def.feedback.style.use(tw('opacity-25'));
          def.rule({
            when: (w) => w.prop('active').eq(true),
            intent: (i) => i.feedback.style.use(tw('opacity-50 bg-blue-500')),
          });
          def.rule({
            when: (w) => w.all(w.prop('active').eq(true), w.state(selected).eq(true)),
            intent: (i) => i.feedback.style.use(tw('opacity-100 text-white')),
          });
          def.event.on('press.commit', () => selected.set(!selected.get()));
          return (r) => {
            renders++;
            return r.el('span', 'stable-rule-content');
          };
        },
      });
      for (let generation = 0; generation < 2; generation++) {
        const view = await mount(proto);
        try {
          await view.flush();
          const root = () => view.host.querySelector<HTMLElement>('[data-pui-root]')!;
          const tokens = () =>
            (root().getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean).sort();
          const assert = (expected: string[]) => {
            expect(tokens()).toEqual([...expected].sort());
            expect(root().classList.contains('rule-user-class')).toBe(true);
            expect(root().textContent).toContain('stable-rule-content');
          };
          const click = async () => {
            const before = renders,
              child = root().querySelector('span');
            await view.click(root());
            await view.flush();
            expect(renders).toBe(before);
            expect(root().querySelector('span')).toBe(child);
          };
          expect(setups).toBe(generation + 1);
          assert(['opacity-25']);
          await view.setProps({ active: true });
          await view.flush();
          assert(['opacity-50', 'bg-blue-500']);
          await click();
          assert(['opacity-100', 'bg-blue-500', 'text-white']);
          await view.setProps({ active: false });
          await view.flush();
          assert(['opacity-25']);
          await view.setProps({ active: true });
          await view.flush();
          assert(['opacity-100', 'bg-blue-500', 'text-white']);
          await click();
          assert(['opacity-50', 'bg-blue-500']);
        } finally {
          await view.unmount();
        }
      }
    });
  });
}
