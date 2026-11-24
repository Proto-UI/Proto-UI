import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogContent,
  type DialogContentProps,
  type DialogContentExposes,
} from '@proto.ui/prototypes-base/dialog';

export type LiquidGlassDialogContentProps = DialogContentProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassDialogContentProps, DialogContentExposes>({
  name: 'liquid-glass-dialog-content',
  setup(def) {
    const behavior = asDialogContent();
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ material: 'auto' });

    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border ring-1 ring-inset ring-border bg-secondary text-secondary-foreground shadow-xl p-5 fixed z-50 left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] -translate-x-1/2 -translate-y-1/2 w-full max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto grid gap-4 outline-none transition-opacity duration-200'
      )
    );
    behavior.asTransition.configure({ enterDuration: 200, leaveDuration: 150 });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.stateHandles.open).eq(true),
          w.not(w.prop('material').eq('opaque'))
        ),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.stateHandles.open).eq(true),
          w.not(w.meta('preference.reducedMotion').eq('reduce'))
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.stateHandles.open).eq(false),
          w.not(w.meta('preference.reducedMotion').eq('reduce'))
        ),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
  },
});
