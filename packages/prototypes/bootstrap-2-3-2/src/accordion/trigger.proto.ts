import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionTriggerProps, AccordionTriggerExposes>({
  name: 'bootstrap-2-3-2-accordion-trigger',
  modules: asAccordionTrigger.modules,
  setup(def) {
    const inherited = asAccordionTrigger();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'block w-full min-w-0 px-[15px] py-[8px] text-start text-[14px] font-normal leading-[20px] text-[#08c] whitespace-normal break-words cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('text-ring')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.collapseBlocked).eq(false),
          w.not(w.meta('colorScheme').eq('dark'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.collapseBlocked).eq(false),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-2 outline-offset-2 outline-ring forced-colors-focus-outline')
        ),
    });
    def.rule({
      when: (w) => w.state(state.collapseBlocked).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
