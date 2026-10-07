import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type Prototype } from '@proto.ui/core';

export type TemplateStyleMount = {
  host: HTMLElement;
  update(): Promise<void>;
  unmount(): Promise<void>;
};

// Issue #788: implementation evidence inside the draft C-TEMPLATE-0002/3
// carrier boundary. This does not promote the portable static-style contract.
export function templateStyleConformance(
  adapter: string,
  mount: (proto: Prototype) => Promise<TemplateStyleMount>
) {
  describe(`${adapter}: owned static Template style`, () => {
    it('merges tokens, preserves caller/slot ownership and clears on update and disposal', async () => {
      let step = 0;
      const proto = definePrototype({
        name: `template-style-${adapter}`,
        setup(def) {
          def.feedback.style.use(tw('opacity-75'));
          return (r) => [
            r.el('section', [
              r.el(
                'span',
                {
                  style:
                    step === 0
                      ? tw('p-2 p-4 opacity-25 opacity-50')
                      : step === 1
                        ? tw('')
                        : step === 2
                          ? undefined
                          : tw('p-1'),
                },
                'owned'
              ),
              r.el('i', 'unstyled'),
              r.slot(),
            ]),
          ];
        },
      });
      // A new mount must not inherit any prior generation's owned style.
      for (let generation = 0; generation < 2; generation++) {
        step = 0;
        const mounted = await mount(proto);
        const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
        try {
          const slot = root.querySelector<HTMLElement>('[data-caller-slot]')!;
          expect(root).toBeTruthy();
          expect(slot).toBeTruthy();
          const rootCarrier = root.getAttribute('data-pui-style');
          const rootClass = root.className;
          expect(rootClass).toContain('caller-root');
          expect(rootCarrier).toContain('opacity-75');
          const assertOwnership = () => {
            expect(root.getAttribute('data-pui-style')).toBe(rootCarrier);
            expect(root.className).toBe(rootClass);
            expect(root.querySelector('[data-caller-slot]')).toBe(slot);
            expect(slot.className).toBe('caller-slot p-8');
            expect(slot.getAttribute('data-pui-style')).toBe('p-6 opacity-100');
            expect(root.querySelector('section')!.hasAttribute('data-pui-style')).toBe(false);
            expect(root.querySelector('i')!.hasAttribute('data-pui-style')).toBe(false);
            expect(root.querySelectorAll('[data-pui-root]')).toHaveLength(0);
          };
          for (const expected of ['p-4 opacity-50', null, null, 'p-1']) {
            if (step > 0) await mounted.update();
            const child = root.querySelector('span')!;
            expect(child.getAttribute('data-pui-style')).toBe(expected);
            expect(child.getAttribute('style')).toBeNull();
            expect(child.getAttribute('class') || null).toBe(adapter === 'wc' ? null : expected);
            assertOwnership();
            step++;
          }
        } finally {
          await mounted.unmount();
          expect(mounted.host.isConnected).toBe(false);
          expect(root.isConnected).toBe(false);
        }
      }
    });
  });
}
