import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldTextControl,
  type FieldControlProps,
  type FieldControlExposes,
} from '@proto.ui/prototypes-base/field';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';

export default definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'liquid-glass-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    def.feedback.style.use(
      tw(
        'h-11 w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground transition-shadow outline-none'
      )
    );
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!binding) throw new Error('[field-control] Base Field binding handle required.');
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.readOnly).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_BLOCKED} bg-muted text-muted-foreground`)),
    });
    def.rule({
      when: (w) => w.state(binding.state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-2 border-destructive')),
    });
    // A static editing surface, never a button deformation or native adaptive blur.
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
    return inherited.render;
  },
});
