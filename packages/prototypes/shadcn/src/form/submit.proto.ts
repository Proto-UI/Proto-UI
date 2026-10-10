import { definePrototype, tw } from '@proto.ui/core';
import {
  asFormSubmit,
  type FormActionExposes,
  type FormActionProps,
} from '@proto.ui/prototypes-base/form';
// Passive shadcn Button paint; Base Form remains the sole action owner.
// Keep rules in the owning setup so source lowering can resolve the actual borrowed states.
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'shadcn-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium transition-all outline-none select-none h-8 gap-1.5 px-2.5 whitespace-nowrap'
      )
    );
    def.feedback.style.use(tw('border-transparent bg-primary text-primary-foreground'));
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    return inherited.render;
  },
});
