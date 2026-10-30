import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardTrigger,
  type HoverCardTriggerProps,
  type HoverCardTriggerExposes,
} from '@proto.ui/prototypes-base/hover-card';

// HoverCard is a Proto link-preview extension. Its passive link paint follows
// @linkColor #08c/no underline, then @linkColorHover #005580/underline on hover/focus.
// Base Trigger authors no activation; the app anchor keeps navigation ownership.
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/scaffolding.less
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/variables.less
export default definePrototype<HoverCardTriggerProps, HoverCardTriggerExposes>({
  name: 'bootstrap-2-3-2-hover-card-trigger',
  setup(def) {
    const behavior = asHoverCardTrigger();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw('inline-flex items-center text-[#08c] no-underline cursor-pointer outline-none')
    );
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) => w.state(state('focused')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed no-underline')),
    });
  },
});
