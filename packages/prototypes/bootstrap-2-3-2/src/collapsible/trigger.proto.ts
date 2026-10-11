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
  setup(def) {
    const state = asCollapsibleTrigger().stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-collapsible-trigger] Missing Base state handles.');
    const { hovered, pressed, focusVisible, disabled } = state;
    // P-BOOTSTRAP-2-3-2-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere whitespace-break-spaces text-left cursor-pointer select-none inline-flex items-center justify-start rounded-[4px] px-[0.9375rem] py-2 text-sm font-normal text-primary'
      )
    );
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
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
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
    });
  },
});

export default collapsibleTrigger;
