import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogContent,
  type AlertDialogContentExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { LiquidGlassAlertDialogContentProps } from './types';

export default definePrototype<LiquidGlassAlertDialogContentProps, AlertDialogContentExposes>({
  name: 'liquid-glass-alert-dialog-content',
  modules: asAlertDialogContent.modules,
  setup(def) {
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm'] },
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ size: 'default', material: 'auto' });
    const behavior = asAlertDialogContent();
    const { open } = behavior.stateHandles;
    // Concentric outer corner radius (rounded-3xl) with generous padding around
    // inner rounded-full pill controls; fallback fill/foreground stay readable when opaque.
    def.feedback.style.use(
      tw(
        'rounded-3xl border border-border ring-1 ring-inset ring-border bg-secondary text-secondary-foreground shadow-xl p-6 fixed z-50 left-[calc(var(--proto-ui-available-region-center-x,50%)_-_var(--proto-ui-available-region-width,100%)/2)] right-[calc(100%_-_var(--proto-ui-available-region-center-x,50%)_-_var(--proto-ui-available-region-width,100%)/2)] top-[calc(var(--proto-ui-available-region-center-y,50%)_-_var(--proto-ui-available-region-height,100%)/2)] bottom-[calc(100%_-_var(--proto-ui-available-region-center-y,50%)_-_var(--proto-ui-available-region-height,100%)/2)] mx-auto my-auto h-fit w-full max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto grid gap-5 outline-none'
      )
    );
    def.rule({
      when: (w) => w.prop('size').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(20rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-200')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(false),
          w.state(behavior.asTransition.transitionState).eq('leaving'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95 duration-150')),
    });
    behavior.asTransition.configure({ enterDuration: 200, leaveDuration: 150 });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});
