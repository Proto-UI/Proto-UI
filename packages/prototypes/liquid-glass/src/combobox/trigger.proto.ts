import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_DISABLED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
import {
  asComboboxTrigger,
  type ComboboxTriggerProps as BaseComboboxTriggerProps,
  type ComboboxTriggerExposes,
} from '@proto.ui/prototypes-base/combobox';

export type ComboboxTriggerProps = BaseComboboxTriggerProps & {
  prominence?: 'regular' | 'prominent';
  /** Auto enhances only when all live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'liquid-glass-combobox-trigger',
  modules: asComboboxTrigger.modules,
  setup(def) {
    const behavior = asComboboxTrigger();
    const disabled = behavior.getState!('disabled')!;
    const pressed = def.state.bool('pressed', false);
    def.props.define({
      prominence: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ prominence: 'regular', material: 'auto' });

    def.event.on('pointer.down', () => {
      if (!disabled.get()) pressed.set(true, 'reason: liquid-glass combobox trigger pointer.down');
    });
    const clearPressed = () =>
      pressed.set(false, 'reason: liquid-glass combobox trigger press ended');
    def.event.on('pointer.up', clearPressed);
    def.event.on('pointer.leave', clearPressed);
    def.event.on('pointer.cancel', clearPressed);
    def.event.on('press.cancel', clearPressed);
    def.event.on('press.commit', clearPressed);
    def.lifecycle.onUnmounted(clearPressed);

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
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const prominence of ['regular', 'prominent'] as const) {
      for (const phase of [false, true]) {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('prominence').eq(prominence),
              w.prop('material').eq('auto'),
              w.state(disabled).eq(false),
              w.state(pressed).eq(phase)
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...(prominence === 'prominent' ? { tint: 'style-fill' as const } : {}),
              deformation: {
                kind: 'press',
                phase: phase ? 'pressed' : 'rest',
                contact: 'pointer',
              },
            }),
        });
      }
    }
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
