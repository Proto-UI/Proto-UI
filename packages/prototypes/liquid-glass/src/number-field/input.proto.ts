import type {
  NumberFieldInputExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldInput } from '@proto.ui/prototypes-base/number-field';
import { COMMAND_FOCUS } from '../interactive-surface';
export type LiquidGlassNumberFieldInputProps = NumberFieldPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassNumberFieldInputProps, NumberFieldInputExposes>({
  name: 'liquid-glass-number-field-input',
  modules: asNumberFieldInput.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asNumberFieldInput();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'block min-h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-2 font-sans text-base tabular-nums text-foreground placeholder:text-muted-foreground outline-none transition-shadow'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.prop('material').eq('auto'), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.readOnly).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground cursor-not-allowed')),
    });
    return inherited.render;
  },
});
