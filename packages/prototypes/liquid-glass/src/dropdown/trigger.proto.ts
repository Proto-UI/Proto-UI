import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS_INSET,
  COMMAND_DISABLED_FOCUSABLE,
  COMMAND_FOCUSED_ELEVATION,
} from '../interactive-surface';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownTrigger,
  type DropdownTriggerProps as BaseDropdownTriggerProps,
  type DropdownTriggerExposes,
} from '@proto.ui/prototypes-base/dropdown';

export interface DropdownTriggerProps extends BaseDropdownTriggerProps {
  /** Opaque retains the same command paint without requesting optical material. */
  material?: 'auto' | 'opaque';
}

export default definePrototype<DropdownTriggerProps, DropdownTriggerExposes>({
  name: 'liquid-glass-dropdown-trigger',
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asDropdownTrigger();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Dropdown Trigger capture missing');
    // One shared optical slot consumes the existing Dropdown command state.
    // Unsupported source/host/preferences retain the complete opaque recipe.
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const isPressed of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('material').eq('auto'),
            w.state(state.pressed).eq(isPressed),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            deformation: {
              kind: 'press',
              phase: isPressed ? 'pressed' : 'rest',
              contact: 'pointer',
            },
          }),
      });
    }
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-secondary text-secondary-foreground px-5 py-2 text-sm font-medium select-none shadow-sm'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false),
          w.state(state.focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    // Retain pointer/programmatic focus elevation separately from hover and keyboard focus.
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focused).eq(true),
          w.state(state.focusVisible).eq(false),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUSED_ELEVATION)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      // Preserve the complete opaque fallback and governed foreground contrast.
      // Whole-host opacity composites both over an uncontrolled backdrop.
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED_FOCUSABLE)),
    });
    return behavior.render;
  },
});
