import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_DISABLED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
import {
  asComboboxTrigger,
  type ComboboxTriggerProps as BaseComboboxTriggerProps,
  type ComboboxTriggerExposes,
} from '@proto.ui/prototypes-base/combobox';

export type ComboboxTriggerProps = BaseComboboxTriggerProps & {
  prominence?: 'regular' | 'prominent';
};

export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'liquid-glass-combobox-trigger',
  modules: asComboboxTrigger.modules,
  setup(def) {
    const behavior = asComboboxTrigger();
    const disabled = behavior.getState!('disabled')!;
    def.props.define({
      prominence: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
    });
    def.props.setDefaults({ prominence: 'regular' });
    def.feedback.style.use(
      tw(
        'font-sans rounded-xl border border-border inline-flex shrink-0 min-w-10 items-center justify-center gap-1.5 px-3 py-2 text-sm shadow-sm outline-none cursor-pointer select-none transition-shadow'
      )
    );
    def.rule({
      when: (w) => w.all(w.prop('prominence').eq('regular'), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('prominence').eq('prominent'), w.state(disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-primary text-primary-foreground border-transparent')),
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
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} bg-muted text-muted-foreground`)),
    });
    return behavior.render;
  },
});
