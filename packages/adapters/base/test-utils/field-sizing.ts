import { definePrototype, tw, type Prototype } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';
import type { ColorSchemeMount, ColorSchemeOptions } from './color-scheme';

/** Real adapter wiring. Token evidence only, not native intrinsic layout evidence. */
export function describeFieldSizingIntegration(
  name: string,
  mount: (proto: Prototype<any>, options: ColorSchemeOptions) => Promise<ColorSchemeMount>
) {
  describe(`${name} finite field sizing projection`, () => {
    it('replaces sizing intent in place without retaining the other choice', async () => {
      const proto = definePrototype<{ enabled?: boolean }>({
        name: `test-${name}-field-sizing`,
        setup(def) {
          def.props.define({ enabled: { type: 'boolean', default: false } });
          def.rule({
            when: (w) => w.prop('enabled').eq(false),
            intent: (i) => i.feedback.style.use(tw('resize-y field-sizing-fixed')),
          });
          def.rule({
            when: (w) => w.prop('enabled').eq(true),
            intent: (i) => i.feedback.style.use(tw('resize-none field-sizing-content')),
          });
          return (r) => r.el('span', 'unchanged content');
        },
      });
      const mounted = await mount(proto, { autoUpdateOnPropsChange: false });
      try {
        await mounted.update();
        const target = mounted.host.querySelector<HTMLElement>('[data-pui-style]')!;
        expect(target).not.toBeNull();
        expect(target.getAttribute('data-pui-style')).toContain('field-sizing-fixed');
        const surface = target;
        await mounted.setProps({ enabled: true });
        await mounted.update();
        expect(mounted.host.querySelector('[data-pui-style]')).toBe(surface);
        expect(mounted.host.textContent).toContain('unchanged content');
        const tokens = target.getAttribute('data-pui-style')!.split(/\s+/);
        expect(tokens).toContain('resize-none');
        expect(tokens).toContain('field-sizing-content');
        expect(tokens).not.toContain('resize-y');
        expect(tokens).not.toContain('field-sizing-fixed');
        await mounted.setProps({ enabled: false });
        await mounted.update();
        expect(target.getAttribute('data-pui-style')).toContain('field-sizing-fixed');
        expect(target.getAttribute('data-pui-style')).not.toContain('field-sizing-content');
      } finally {
        await mounted.unmount();
      }
    });
  });
}
