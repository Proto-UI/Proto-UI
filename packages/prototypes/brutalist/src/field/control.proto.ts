import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldTextControl,
  type FieldControlProps,
  type FieldControlExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'brutalist-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    def.feedback.style.use(
      tw(
        'h-10 w-full min-w-0 rounded-base border-2 border-border bg-secondary-background px-3 py-2 font-sans text-sm font-medium text-foreground outline-none'
      )
    );
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!binding) throw new Error('[field-control] Base Field binding handle required.');
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
      when: (w) => w.state(binding.state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-2 border-foreground')),
    });
    return inherited.render;
  },
});
