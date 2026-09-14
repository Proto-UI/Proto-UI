import { expect, it } from 'vitest';
import { definePrototype, tw, type Prototype } from '@proto.ui/core';
export type RuleWebProps = { active?: boolean };
type View = {
  host: HTMLElement;
  setProps(p: RuleWebProps): Promise<void>;
  flush(): Promise<void>;
  click(el: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};
export function ruleWebAdapterConformance(
  name: string,
  mount: (proto: Prototype<RuleWebProps>) => Promise<View>
) {
  it('T-RULE-EXPOSE-STATE-WEB-0001-CASE-ADAPTER: selector and default paths follow transitions on real framework owners', async () => {
    let renders = 0;
    const proto = definePrototype<RuleWebProps>({
      name: `rule-web-${name}`,
      setup(def) {
        def.props.define({ active: { type: 'boolean', default: false } });
        const open = def.state.bool('open', false);
        const blocked = def.state.bool('blocked', false);
        const range = def.state.numberRange('range', 0, { min: 0, max: 1 });
        def.expose.state('open', open);
        def.expose.state('blocked', blocked);
        def.expose.state('range', range);
        def.rule({
          when: (w) => w.all(w.state(open).eq(true), w.state(blocked).eq(false)),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        def.rule({
          when: (w) => w.state(open).eq(false),
          intent: (i) => i.feedback.style.use(tw('hidden')),
        });
        def.rule({
          when: (w) => w.state(range).eq(1),
          intent: (i) => i.feedback.style.use(tw('underline')),
        });
        def.rule({
          when: (w) => w.prop('active').eq(true),
          intent: (i) => i.feedback.style.use(tw('font-bold')),
        });
        def.event.on('press.commit', () => {
          open.set(!open.get());
          range.set(open.get() ? 1 : 0);
        });
        return (r) => {
          renders++;
          return r.el('span', 'rule-web');
        };
      },
    });
    for (let owner = 0; owner < 2; owner++) {
      const view = await mount(proto);
      try {
        await view.flush();
        const root = view.host.querySelector<HTMLElement>('[data-pui-root]')!;
        const tokens = () =>
          (root.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean).sort();
        const optimized = 'data-[open]:not-[data-blocked]:opacity-50';
        expect(tokens()).toEqual([optimized, 'hidden'].sort());
        expect(root.hasAttribute('data-open')).toBe(false);
        const before = renders,
          child = root.querySelector('span');
        await view.click(root);
        await view.flush();
        expect(tokens()).toEqual([optimized, 'underline'].sort());
        expect(root.getAttribute('data-open')).toBe('');
        expect(root.hasAttribute('data-blocked')).toBe(false);
        expect(renders).toBe(before);
        expect(root.querySelector('span')).toBe(child);
        await view.setProps({ active: true });
        await view.flush();
        expect(tokens()).toEqual([optimized, 'underline', 'font-bold'].sort());
        await view.click(root);
        await view.flush();
        expect(tokens()).toEqual([optimized, 'hidden', 'font-bold'].sort());
        expect(root.hasAttribute('data-open')).toBe(false);
        expect(root.classList.contains('rule-user-class')).toBe(true);
        expect(root.classList.contains(optimized)).toBe(false);
      } finally {
        await view.unmount();
      }
    }
  });
}
