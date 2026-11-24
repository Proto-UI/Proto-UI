import { definePrototype, tw, delay, type RunHandle } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'brutalist-accordion-trigger',
  modules: asAccordionTrigger.modules,
  setup(def) {
    const state = asAccordionTrigger().stateHandles!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 items-center justify-between gap-4 p-4 text-start text-base font-heading font-bold bg-main text-main-foreground border-border leading-relaxed whitespace-normal break-words cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-3 ring-inset ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.collapseBlocked).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('translate-y-px shadow-[inset_0_0_0_2px_#000]')),
    });
    def.rule({
      when: (w) => w.state(state.expanded).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-b-2')),
    });
    def.rule({
      when: (w) => w.state(state.collapseBlocked).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    let pending: { cancel(): void } | null = null;
    let mounted = false;
    const refresh = (run: RunHandle<AccordionTriggerProps>) => {
      if (!mounted) return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        if (mounted) run.update();
      });
    };
    state.expanded.watch((run, event) => {
      if (event.type === 'next') refresh(run);
    });
    def.lifecycle.onMounted(() => {
      mounted = true;
    });
    def.lifecycle.onUnmounted(() => {
      mounted = false;
      pending?.cancel();
      pending = null;
    });
    def.lifecycle.onBeforeDispose(() => {
      mounted = false;
      pending?.cancel();
      pending = null;
    });
    return (r) => [
      r.slot(),
      r.el(
        'span',
        { style: tw('pointer-events-none ms-auto flex shrink-0 items-center') },
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
