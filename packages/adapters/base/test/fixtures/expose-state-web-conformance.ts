import { expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
export type ExposeStateWebTree = { proto: Prototype; children?: ExposeStateWebTree[] };
type View = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};
export function exposeStateWebAdapterConformance(
  name: string,
  mount: (
    tree: ExposeStateWebTree[],
    options: { exposeStateWebMode?: { allowStringVar: boolean; allowContinuousAttr: boolean } }
  ) => Promise<View>
) {
  for (const override of [false, true]) {
    it(`T-EXPOSE-STATE-WEB-0001-CASE-ADAPTER: ${override ? 'overridden' : 'default'} projection follows live State without structural rendering`, async () => {
      let renders = 0;
      const proto = definePrototype({
        name: `esw-${name}-${override ? 'mode' : 'default'}`,
        setup(def) {
          const flag = def.state.bool('@accessibility/checked', false);
          const text = def.state.string('labelText', 'before');
          const choice = def.state.enum('size', 'sm', { options: ['sm', 'lg'] });
          const count = def.state.numberDiscrete('list.count', 1);
          const range = def.state.numberRange('progress', 0.2, { min: 0, max: 1 });
          for (const [key, state] of Object.entries({ flag, text, choice, count, range }))
            def.expose(key, state);
          def.expose('unclassified', 'not-a-state');
          def.event.on('press.commit', () => {
            const next = !flag.get();
            flag.set(next);
            text.set(next ? 'after' : 'before');
            choice.set(next ? 'lg' : 'sm');
            count.set(next ? 2 : 1);
            range.set(next ? 0.8 : 0.2);
          });
          return (r) => {
            renders++;
            return r.el('span', 'state marker');
          };
        },
      });
      for (let owner = 0; owner < 2; owner++) {
        const view = await mount([{ proto }], {
          exposeStateWebMode: override
            ? { allowStringVar: true, allowContinuousAttr: true }
            : undefined,
        });
        try {
          await view.flush();
          const root = view.host.querySelector<HTMLElement>('[data-pui-root]')!;
          const child = root.querySelector('span');
          root.setAttribute('data-consumer', 'kept');
          const baselineRenders = renders;
          const assert = (next: boolean) => {
            expect(root.getAttribute('data-checked')).toBe(next ? '' : null);
            expect(root.style.getPropertyValue('--pui-checked')).toBe('');
            expect(root.getAttribute('data-label-text')).toBe(next ? 'after' : 'before');
            expect(root.style.getPropertyValue('--pui-label-text')).toBe(
              override ? (next ? 'after' : 'before') : ''
            );
            expect(root.getAttribute('data-size')).toBe(next ? 'lg' : 'sm');
            expect(root.getAttribute('data-list-count')).toBe(next ? '2' : '1');
            expect(root.style.getPropertyValue('--pui-list-count')).toBe(next ? '2' : '1');
            expect(root.getAttribute('data-progress')).toBe(
              override ? (next ? '0.8' : '0.2') : null
            );
            expect(root.style.getPropertyValue('--pui-progress')).toBe(next ? '0.8' : '0.2');
            expect(root.hasAttribute('aria-checked')).toBe(false);
            expect(root.hasAttribute('data-unclassified')).toBe(false);
            expect(root.getAttribute('data-consumer')).toBe('kept');
            expect(root.querySelector('span')).toBe(child);
            expect(renders).toBe(baselineRenders);
          };
          assert(false);
          await view.click(root);
          await view.flush();
          assert(true);
          await view.click(root);
          await view.flush();
          assert(false);
        } finally {
          await view.unmount();
        }
      }
    });
  }
}
