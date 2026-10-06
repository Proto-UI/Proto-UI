import { definePrototype, tw, delay } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'bootstrap-2-3-2-accordion-trigger',
  setup(def) {
    const state = asAccordionTrigger().stateHandles!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 items-center justify-between gap-3 px-[15px] py-[8px] text-start text-sm font-normal leading-5 text-primary whitespace-normal break-words cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-offset-2 outline-ring')),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-secondary')),
    });
    def.rule({
      when: (w) => w.state(state.expanded).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-primary')),
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
