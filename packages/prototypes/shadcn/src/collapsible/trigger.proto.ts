import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleTrigger } from '@proto.ui/prototypes-base/collapsible';
import type { ShadcnCollapsibleTriggerProps, ShadcnCollapsibleTriggerExposes } from './types';

// P-SHADCN-COLLAPSIBLE-TRIGGER-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleTrigger = definePrototype<
  ShadcnCollapsibleTriggerProps,
  ShadcnCollapsibleTriggerExposes
>({
  name: 'shadcn-collapsible-trigger',
  setup(def) {
    const state = asCollapsibleTrigger().stateHandles;
    if (!state) throw new Error('[shadcn-collapsible-trigger] Missing Base state handles.');
    const { hovered, pressed, focusVisible, disabled } = state;
    // P-SHADCN-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere whitespace-pre-wrap text-left cursor-pointer select-none inline-flex items-center justify-start rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm'
      )
    );
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted shadow-none')),
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
