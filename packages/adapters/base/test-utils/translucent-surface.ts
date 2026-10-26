import { definePrototype, tw, type Prototype } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';
import type { ColorSchemeMount, ColorSchemeOptions } from './color-scheme';

/** Real adapter wiring. Token evidence only, not native backdrop raster evidence. */
export function describeTranslucentSurfaceIntegration(
  name: string,
  mount: (proto: Prototype<any>, options: ColorSchemeOptions) => Promise<ColorSchemeMount>
) {
  describe(`${name} finite translucent surface projection`, () => {
    it('withdraws theme-derived paint without rebuilding the physical surface', async () => {
      const html = document.documentElement;
      const oldClass = html.className;
      const oldTheme = html.getAttribute('data-theme');
      html.classList.remove('dark', 'light');
      html.dataset.theme = 'light';
      const proto = definePrototype({
        name: `test-${name}-translucent-theme`,
        setup(def) {
          def.props.define({ enabled: { type: 'boolean', default: true } });
          def.feedback.style.use(tw('backdrop-blur-xs bg-popover/70'));
          def.rule({
            when: (w) => w.all(w.prop('enabled').eq(true), w.meta('colorScheme').eq('dark')),
            intent: (i) => i.feedback.style.use(tw('backdrop-filter-[blur(40px)_saturate(1.5)]')),
          });
          return (r) => r.el('span', 'stable child');
        },
      });
      const mounted = await mount(proto, { autoUpdateOnPropsChange: false });
      try {
        await mounted.act(() => {});
        const surface = mounted.host.querySelector<HTMLElement>('[data-pui-style]')!;
        const child = surface.querySelector('span');
        expect(surface.getAttribute('data-pui-style')).toContain('backdrop-blur-xs');
        await mounted.act(() => {
          html.dataset.theme = 'dark';
        });
        expect(surface.getAttribute('data-pui-style')).toContain(
          'backdrop-filter-[blur(40px)_saturate(1.5)]'
        );
        expect(surface.getAttribute('data-pui-style')).not.toContain('backdrop-blur-xs');
        await mounted.act(() => {
          html.dataset.theme = 'light';
        });
        expect(surface.getAttribute('data-pui-style')).toContain('backdrop-blur-xs');
        expect(surface.getAttribute('data-pui-style')).not.toContain(
          'backdrop-filter-[blur(40px)_saturate(1.5)]'
        );
        expect(surface.getAttribute('data-pui-style')).toContain('bg-popover/70');
        expect(mounted.host.querySelector('[data-pui-style]')).toBe(surface);
        expect(surface.querySelector('span')).toBe(child);
      } finally {
        await mounted.unmount();
        html.className = oldClass;
        if (oldTheme === null) html.removeAttribute('data-theme');
        else html.setAttribute('data-theme', oldTheme);
      }
    });
    it('replaces sizing intent in place without retaining the other choice', async () => {
      const proto = definePrototype<{ enabled?: boolean }>({
        name: `test-${name}-translucent-surface`,
        setup(def) {
          def.props.define({ enabled: { type: 'boolean', default: false } });
          def.feedback.style.use(tw('z-10'));
          def.rule({
            when: (w) => w.prop('enabled').eq(false),
            intent: (i) => i.feedback.style.use(tw('backdrop-blur-xs rounded-md')),
          });
          def.rule({
            when: (w) => w.prop('enabled').eq(true),
            intent: (i) =>
              i.feedback.style.use(
                tw(
                  'backdrop-filter-[blur(40px)_saturate(1.5)] rounded-[inherit] isolate -z-1 min-w-36'
                )
              ),
          });
          return (r) => r.el('span', 'unchanged content');
        },
      });
      const mounted = await mount(proto, { autoUpdateOnPropsChange: false });
      try {
        await mounted.update();
        const target = mounted.host.querySelector<HTMLElement>('[data-pui-style]')!;
        expect(target).not.toBeNull();
        expect(target.getAttribute('data-pui-style')).toContain('backdrop-blur-xs');
        const surface = target;
        await mounted.setProps({ enabled: true });
        await mounted.update();
        expect(mounted.host.querySelector('[data-pui-style]')).toBe(surface);
        expect(mounted.host.textContent).toContain('unchanged content');
        const tokens = target.getAttribute('data-pui-style')!.split(/\s+/);
        for (const token of ['rounded-[inherit]', 'isolate', '-z-1', 'min-w-36'])
          expect(tokens).toContain(token);
        expect(tokens).toContain('backdrop-filter-[blur(40px)_saturate(1.5)]');
        expect(tokens).not.toContain('rounded-md');
        expect(tokens).not.toContain('z-10');
        expect(tokens).not.toContain('backdrop-blur-xs');
        await mounted.setProps({ enabled: false });
        await mounted.update();
        expect(target.getAttribute('data-pui-style')).toContain('backdrop-blur-xs');
        expect(target.getAttribute('data-pui-style')!.split(/\s+/)).toContain('z-10');
        for (const token of [
          'backdrop-filter-[blur(40px)_saturate(1.5)]',
          'rounded-[inherit]',
          'isolate',
          '-z-1',
          'min-w-36',
        ])
          expect(target.getAttribute('data-pui-style')!.split(/\s+/)).not.toContain(token);
      } finally {
        await mounted.unmount();
      }
    });
  });
}
