import type {
  InputOtpControlExposes,
  InputOtpInputProps,
} from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpControl } from '@proto.ui/prototypes-base/input-otp';
import { COMMAND_BLOCKED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';

export type LiquidGlassInputOtpControlProps = InputOtpInputProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassInputOtpControlProps, InputOtpControlExposes>({
  name: 'liquid-glass-input-otp-control',
  modules: asInputOtpControl.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asInputOtpControl();
    const binding = inherited.getAsHookHandle?.('as-field-control');
    def.feedback.style.use(
      tw(
        'block min-h-11 min-w-0 flex-1 rounded-2xl border border-border bg-secondary px-4 py-2 font-sans text-base tabular-nums text-foreground placeholder:text-muted-foreground shadow-xs ring-1 ring-inset ring-foreground/10 outline-none transition-shadow duration-200'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('material').eq('auto'), w.state(inherited.stateHandles!.disabled).eq(false)),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) =>
        binding
          ? w.all(
              w.state(inherited.stateHandles!.focusVisible).eq(true),
              w.state(binding.state.invalid).eq(false)
            )
          : w.state(inherited.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${COMMAND_FOCUS} ${COMMAND_FOCUSED_ELEVATION} bg-background`)),
    });
    if (binding) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(binding.state.invalid).eq(true),
            w.state(inherited.stateHandles!.focusVisible).eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(tw('border-destructive ring-1 ring-inset ring-destructive/20')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(binding.state.invalid).eq(true),
            w.state(inherited.stateHandles!.focusVisible).eq(true)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              `border-destructive bg-background outline-none forced-colors-focus-outline ring-2 ring-destructive ring-offset-2 ring-offset-background ${COMMAND_FOCUSED_ELEVATION}`
            )
          ),
      });
    }
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`bg-muted text-muted-foreground ${COMMAND_BLOCKED}`)),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
