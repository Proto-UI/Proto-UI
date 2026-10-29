import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'bootstrap-2-3-2-accordion-trigger',
  setup(def) {
    const inherited = asAccordionTrigger();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'block w-full min-w-0 px-[15px] py-[8px] text-left text-[14px] font-normal leading-[20px] text-[#08c] whitespace-normal break-words cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-offset-2 outline-ring')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
