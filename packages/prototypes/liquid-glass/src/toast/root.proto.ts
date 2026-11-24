import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps as BaseToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export type LiquidGlassToastMaterial = 'auto' | 'opaque';
export type LiquidGlassToastProminence = 'regular' | 'prominent' | 'destructive';

export type ToastRootProps = BaseToastRootProps & {
  material?: LiquidGlassToastMaterial;
  prominence?: LiquidGlassToastProminence;
};

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'liquid-glass-toast-root',
  setup(def) {
    const behavior = asToastRoot();
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
        'rounded-2xl border border-border ring-1 ring-inset ring-border bg-secondary text-secondary-foreground shadow-lg grid gap-2 min-w-0 w-full p-4 text-start font-sans'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) => i.feedback.style.use(tw('border-primary ring-primary shadow-xl')),
    });
    def.rule({
      when: (w) => w.prop('prominence').eq('destructive'),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive shadow-xl')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(w.state(behavior.getState!('open')!).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    return behavior.render;
  },
});
