import { definePrototype, tw, type RendererHandle } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps as BaseToastRootProps,
  type ToastRootExposes,
  type ToastType,
} from '@proto.ui/prototypes-base/toast';

export type LiquidGlassToastMaterial = 'auto' | 'opaque';
export type LiquidGlassToastProminence = 'regular' | 'prominent' | 'destructive';

export type ToastRootProps = BaseToastRootProps & {
  material?: LiquidGlassToastMaterial;
  prominence?: LiquidGlassToastProminence;
};

function renderGlassToastIcon(r: RendererHandle<any>, kind: ToastType) {
  if (kind === 'default') return null;
  const svgBase = {
    viewBox: '0 0 24 24',
    width: '16',
    height: '16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': 'true' as const,
  };
  if (kind === 'success') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-primary') },
      r.svg.root(svgBase, [
        r.svg.circle({ cx: 12, cy: 12, r: 10 }),
        r.svg.path({ d: 'm9 12 2 2 4-4' }),
      ])
    );
  }
  if (kind === 'info') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-primary') },
      r.svg.root(svgBase, [
        r.svg.circle({ cx: 12, cy: 12, r: 10 }),
        r.svg.path({ d: 'M12 16v-4' }),
        r.svg.path({ d: 'M12 8h.01' }),
      ])
    );
  }
  if (kind === 'warning') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-foreground') },
      r.svg.root(svgBase, [
        r.svg.path({
          d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
        }),
        r.svg.path({ d: 'M12 9v4' }),
        r.svg.path({ d: 'M12 17h.01' }),
      ])
    );
  }
  if (kind === 'error') {
    return r.el(
      'span',
      { style: tw('inline-flex shrink-0 items-center justify-center mt-0.5 text-destructive') },
      r.svg.root(svgBase, [
        r.svg.circle({ cx: 12, cy: 12, r: 10 }),
        r.svg.path({ d: 'm15 9-6 6' }),
        r.svg.path({ d: 'm9 9 6 6' }),
      ])
    );
  }
  return r.el(
    'span',
    {
      style: tw(
        'inline-flex shrink-0 items-center justify-center mt-0.5 text-muted-foreground animate-spin'
      ),
    },
    r.svg.root(svgBase, [r.svg.path({ d: 'M21 12a9 9 0 1 1-6.219-8.56' })])
  );
}

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'liquid-glass-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    const state = behavior.stateHandles!;
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
      prominence: {
        type: 'enum',
        empty: 'fallback',
        options: ['regular', 'prominent', 'destructive'],
      },
    });
    def.props.setDefaults({ material: 'auto', prominence: 'regular' });
    // Rounded-2xl glass banner with inset specular rim highlight and opaque
    // high-contrast fallback; inner capsule buttons stay concentric without stacking glass.
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border ring-1 ring-inset ring-border bg-secondary text-secondary-foreground shadow-lg flex items-start gap-3 min-w-0 w-full p-4 text-start font-sans'
      )
    );
    def.rule({
      when: (w) =>
        w.any(
          w.prop('prominence').eq('prominent'),
          w.all(
            w.prop('prominence').eq('regular'),
            w.any(w.state(state.type).eq('success'), w.state(state.type).eq('info'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border-primary ring-primary shadow-xl')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.prop('prominence').eq('destructive'),
          w.all(w.prop('prominence').eq('regular'), w.state(state.type).eq('error'))
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive shadow-xl')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.state(state.open).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    return (r) => {
      const icon = renderGlassToastIcon(r, state.type.get());
      if (!icon) return r.el('div', { style: tw('grid gap-2 min-w-0 flex-1') }, r.slot());
      return [icon, r.el('div', { style: tw('grid gap-2 min-w-0 flex-1') }, r.slot())];
    };
  },
});
