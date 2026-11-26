import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardTrigger,
  type HoverCardTriggerProps,
  type HoverCardTriggerExposes,
} from '@proto.ui/prototypes-base/hover-card';

// HoverCard is a Proto link-preview extension. Resting ink follows Bootstrap 2.3.2 @linkColor (#08c). Hover and focus
// use the theme foreground with an underline in both color schemes.
// Base Trigger authors no activation; the app anchor keeps navigation ownership.
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/scaffolding.less
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/variables.less
export default definePrototype<HoverCardTriggerProps, HoverCardTriggerExposes>({
  name: 'bootstrap-2-3-2-hover-card-trigger',
  setup(def) {
    const behavior = asHoverCardTrigger();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex items-center rounded-sm text-sm leading-5 cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.any(
          w.state(state('disabled')!).eq(true),
          w.all(w.state(state('hovered')!).eq(false), w.state(state('focused')!).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#08c] no-underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('disabled')!).eq(false),
          w.any(w.state(state('hovered')!).eq(true), w.state(state('focused')!).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground underline')),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-not-allowed no-underline')),
    });
  },
});
