import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldTextControl,
  type FieldControlProps,
  type FieldControlExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'bootstrap-2-3-2-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    def.feedback.style.use(
      tw(
        'block w-full min-w-0 rounded-[4px] border border-border bg-background px-1.5 py-1 text-sm font-normal leading-5 text-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] outline-none'
      )
    );
    const state = inherited.stateHandles!;
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-2 ring-destructive')),
    });
    return inherited.render;
  },
});
