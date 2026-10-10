import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldTextControl,
  type FieldControlProps,
  type FieldControlExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'shadcn-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    // base-nova geometry; responsive md:text-sm needs a governed viewport fact.
    // Feedback v0 forbids selector variants, so retain its accessible 16px base size.
    def.feedback.style.use(
      tw(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none'
      )
    );
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!binding) throw new Error('[field-control] Base Field binding handle required.');
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('forced-colors-focus-outline border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed bg-input/50')),
    });
    def.rule({
      when: (w) => w.state(binding.state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-3 ring-destructive/20')),
    });
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(state.disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-input/80')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(binding.state.invalid).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-destructive/50 ring-destructive/40')),
    });
    return inherited.render;
  },
});
