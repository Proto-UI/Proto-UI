import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpSlot, INPUT_OTP_CONTEXT } from '@proto.ui/prototypes-base/input-otp';
import { COMMAND_BLOCKED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
import { LIQUID_GLASS_INPUT_OTP_VISUAL, type LiquidGlassInputOtpSlotProps } from './visual';

// Content-layer OTP slot: concentric rounded-xl inside rounded-2xl containers,
// specular inset hairline, and readable non-opacity disabled fallback.
export default definePrototype<LiquidGlassInputOtpSlotProps, InputOtpSlotExposes>({
  name: 'liquid-glass-input-otp-slot',
  modules: asInputOtpSlot.modules,
  setup(def) {
    const inherited = asInputOtpSlot();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false, material: 'auto' });
    const invalid = def.state.bool('liquidGlassOtpSlotInvalid', false);
    const disabled = def.state.bool('liquidGlassOtpSlotDisabled', false);
    const syncVisual = (run: RunHandle<LiquidGlassInputOtpSlotProps>) => {
      const visual = run.context.tryRead(LIQUID_GLASS_INPUT_OTP_VISUAL);
      const otp = run.context.read(INPUT_OTP_CONTEXT);
      const field = run.context.tryRead(FIELD_CONTEXT);
      invalid.set(
        Boolean(run.props.get().invalid || visual?.invalid || field?.invalid),
        'reason: Liquid Glass OTP slot invalid'
      );
      disabled.set(
        Boolean(otp.disabled || visual?.disabled),
        'reason: Liquid Glass OTP slot disabled'
      );
    };
    def.context.trySubscribe(LIQUID_GLASS_INPUT_OTP_VISUAL, syncVisual);
    def.context.subscribe(INPUT_OTP_CONTEXT, syncVisual);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.props.watch(['invalid'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.feedback.style.use(
      tw(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary font-sans text-lg font-medium tabular-nums text-foreground shadow-xs ring-1 ring-inset ring-foreground/10 outline-none transition-shadow duration-200'
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
        w.all(w.state(inherited.stateHandles!.active).eq(true), w.state(invalid).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw(`z-10 border-ring bg-background ${COMMAND_FOCUS} ${COMMAND_FOCUSED_ELEVATION}`)
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.active).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-destructive text-destructive ring-1 ring-inset ring-destructive/20')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.active).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            `z-10 border-destructive bg-background text-destructive outline-none forced-colors-focus-outline ring-2 ring-destructive ring-offset-2 ring-offset-background ${COMMAND_FOCUSED_ELEVATION}`
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`bg-muted text-muted-foreground ${COMMAND_BLOCKED}`)),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
