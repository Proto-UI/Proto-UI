import { definePrototype, tw, delay } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
// Explicit optical intent over the independent Base Trigger. A missing host sink must retain the opaque fallback, never substitute adaptive native blur.
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'liquid-glass-accordion-trigger',
  setup(def) {
    const state = asAccordionTrigger().stateHandles!;
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    // Exactly one complete candidate applies; no static candidate is stacked
    // underneath the pressed Rule, and no button profile is inferred by name.
    for (const pressed of [false, true]) {
      def.rule({
        when: (w) => w.state(state.pressed).eq(pressed),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            deformation: { kind: 'press', phase: pressed ? 'pressed' : 'rest' },
          }),
      });
    }
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 text-start text-base font-medium leading-relaxed whitespace-normal break-words cursor-pointer select-none outline-none rounded-2xl bg-background text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-secondary')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-secondary')),
    });
    def.rule({
      when: (w) => w.state(state.expanded).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    let pending: { cancel(): void } | null = null;
    state.expanded.watch((run, event) => {
      if (event.type !== 'next') return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        run.update();
      });
    });
    def.lifecycle.onUnmounted(() => {
      pending?.cancel();
      pending = null;
    });
    return (r) => [
      r.slot(),
      r.svg.root(
        {
          viewBox: '0 0 24 24',
          width: '16',
          height: '16',
          'aria-hidden': 'true',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        r.svg.path({ d: state.expanded.get() ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6' })
      ),
    ];
  },
});
