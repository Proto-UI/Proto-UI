import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
import {
  asComboboxInput,
  type ComboboxInputProps as BaseComboboxInputProps,
  type ComboboxInputExposes,
} from '@proto.ui/prototypes-base/combobox';

export type ComboboxInputProps = BaseComboboxInputProps & {
  /** Auto enhances only when live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<ComboboxInputProps, ComboboxInputExposes>({
  name: 'liquid-glass-combobox-input',
  modules: asComboboxInput.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asComboboxInput();
    const disabled = behavior.getState!('disabled')!;
    def.feedback.style.use(
      tw(
        'font-sans rounded-xl border border-border min-w-0 grow bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground outline-none transition-shadow'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.prop('material').eq('auto'), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(behavior.getState!('focused')!).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUSED_ELEVATION)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('duration-0')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_BLOCKED} bg-muted text-muted-foreground`)),
    });
    return behavior.render;
  },
});
