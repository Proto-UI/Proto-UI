import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverContent, type PopoverContentExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverContentProps } from './types';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'liquid-glass-popover-content',
  modules: asPopoverContent.modules,
  setup(def) {
    const behavior = asPopoverContent();
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
      prominence: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
    });
    def.props.setDefaults({
      material: 'auto',
      prominence: 'regular',
    });
    // Outer rounded-2xl (16px) with p-4 (16px) pairs concentrically with inner
    // rounded-xl controls and provides a readable opaque fallback surface.
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground font-sans p-4 z-50 w-80 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto flex flex-col gap-3 outline-none transition-none'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('regular'),
      intent: (i) => i.feedback.style.use(tw('shadow-md ring-1 ring-inset ring-foreground/10')),
    });
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) => i.feedback.style.use(tw('shadow-lg ring-1 ring-inset ring-border')),
    });
    const { open } = behavior.stateHandles;
    // Keep the entry animation within Base's finite perceptual phase so a
    // forwards-filled transform never survives into optical rest.
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 0 });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
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
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('animate-none transition-none')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    // Withdraw translucent glass automatically for explicit opaque opt-out,
    // Reduced Transparency, or Forced Colors so contrast stays readable.
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.prop('material').eq('auto'),
          w.not(w.meta('preference.reducedTransparency').eq('reduce')),
          w.not(w.meta('preference.forcedColors').eq('active'))
        ),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});
