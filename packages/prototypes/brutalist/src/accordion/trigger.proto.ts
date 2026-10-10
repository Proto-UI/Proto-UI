import { definePrototype, tw, delay } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'brutalist-accordion-trigger',
  setup(def) {
    const state = asAccordionTrigger().stateHandles!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 items-center justify-between gap-4 p-4 text-start text-base font-heading font-bold bg-main text-main-foreground border-border leading-relaxed whitespace-normal break-words cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-3 ring-ring')),
    });
    def.rule({
      when: (w) => w.state(state.expanded).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-b-2')),
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
      r.el(
        'span',
        { style: tw('pointer-events-none flex shrink-0 items-center') },
        r.svg.root(
          {
            viewBox: '0 0 24 24',
            width: '20',
            height: '20',
            'aria-hidden': 'true',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          r.svg.path({ d: state.expanded.get() ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6' })
        )
      ),
    ];
  },
});
