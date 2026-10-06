import { definePrototype, tw, delay } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'shadcn-accordion-trigger',
  setup(def) {
    const state = asAccordionTrigger().stateHandles!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 items-center justify-between gap-4 py-4 text-start text-sm font-medium leading-relaxed whitespace-normal break-words cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('ring-2 ring-ring ring-offset-2 ring-offset-background rounded-sm')
        ),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
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
