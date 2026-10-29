import { definePrototype, tw, delay } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
import { setupAccordionStyle } from './visual';
import type { ShadcnAccordionTriggerProps } from './types';
export default definePrototype<ShadcnAccordionTriggerProps, AccordionTriggerExposes>({
  name: 'shadcn-accordion-trigger',
  modules: asAccordionTrigger.modules,
  setup(def) {
    const inherited = asAccordionTrigger();
    const state = inherited.stateHandles!;
    const style = setupAccordionStyle(def);
    def.feedback.style.use(
      tw(
        'relative flex flex-1 w-full min-w-0 items-start justify-between text-start whitespace-normal break-words cursor-pointer select-none outline-none transition-all'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(style).eq('vega'), w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('gap-4 rounded-md py-4 text-sm font-medium')),
    });
    def.rule({
      when: (w) => w.state(style).eq('nova'),
      intent: (i) => i.feedback.style.use(tw('gap-4 rounded-lg py-2.5 text-sm font-medium')),
    });
    def.rule({
      when: (w) => w.state(style).eq('lyra'),
      intent: (i) => i.feedback.style.use(tw('gap-4 rounded-none py-2.5 text-xs font-medium')),
    });
    def.rule({
      when: (w) =>
        w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('rhea')),
      intent: (i) => i.feedback.style.use(tw('gap-6 p-4 text-sm font-medium')),
    });
    def.rule({
      when: (w) => w.state(style).eq('mira'),
      intent: (i) => i.feedback.style.use(tw('gap-6 p-2 text-xs leading-relaxed font-medium')),
    });
    def.rule({
      when: (w) => w.state(style).eq('sera'),
      intent: (i) => i.feedback.style.use(tw('gap-6 rounded-none py-4 text-sm font-semibold')),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('border border-transparent')),
    });
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focusVisible).eq(true),
          w.any(
            w.state(style).eq('vega'),
            w.state(style).eq('nova'),
            w.state(style).eq('new-york-v4')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.focusVisible).eq(true), w.state(style).eq('lyra')),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-1 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.focusVisible).eq(true), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-2 ring-ring/30')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none')),
    });
    let pending: { cancel(): void } | null = null;
    for (const fact of [state.expanded, style]) {
      fact.watch((run, event) => {
        if (event.type !== 'next') return;
        pending?.cancel();
        pending = delay(0, () => {
          pending = null;
          run.update();
        });
      });
    }
    def.lifecycle.onUnmounted(() => {
      pending?.cancel();
      pending = null;
    });
    return (r) => [
      r.slot(),
      r.el(
        'span',
        {
          style:
            style.get() === 'sera'
              ? tw(
                  'pointer-events-none ml-auto flex size-3.5 shrink-0 items-center text-muted-foreground'
                )
              : tw(
                  'pointer-events-none ml-auto flex size-4 shrink-0 items-center text-muted-foreground'
                ),
        },
        r.svg.root(
          {
            viewBox: '0 0 24 24',
            width: '100%',
            height: '100%',
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
