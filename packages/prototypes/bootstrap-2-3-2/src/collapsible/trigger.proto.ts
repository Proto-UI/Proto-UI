import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleTrigger } from '@proto.ui/prototypes-base/collapsible';
import type {
  Bootstrap232CollapsibleTriggerProps,
  Bootstrap232CollapsibleTriggerExposes,
} from './types';

// P-BOOTSTRAP-2-3-2-COLLAPSIBLE-TRIGGER-BASE-INHERITANCE: Base is the only semantic owner.
const collapsibleTrigger = definePrototype<
  Bootstrap232CollapsibleTriggerProps,
  Bootstrap232CollapsibleTriggerExposes
>({
  name: 'bootstrap-2-3-2-collapsible-trigger',
  modules: asCollapsibleTrigger.modules,
  setup(def) {
    const inherited = asCollapsibleTrigger();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-collapsible-trigger] Missing Base state handles.');
    const { hovered, pressed, focusVisible, disabled } = state;
    // P-BOOTSTRAP-2-3-2-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'block w-full min-w-0 max-w-full wrap-anywhere whitespace-break-spaces text-left cursor-pointer select-none px-[15px] py-[8px] text-[14px] leading-[20px] font-normal text-[#08c]'
      )
    );
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('text-ring')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true)),
          w.not(w.meta('colorScheme').eq('dark'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(pressed).eq(true)),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground underline')),
    });
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default')),
    });
    return inherited.render;
  },
});

export default collapsibleTrigger;
