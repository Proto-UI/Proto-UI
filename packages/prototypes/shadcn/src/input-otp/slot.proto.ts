import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpSlot, INPUT_OTP_CONTEXT } from '@proto.ui/prototypes-base/input-otp';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnInputOtpSlotProps } from './types';
import { INPUT_OTP_VISUAL } from './visual';

/** Source .cn-input-otp-slot; endpoints support both full-code defaults and explicit split groups. */
const SLOT_SURFACE = {
  vega: 'size-9 border-y border-r border-input bg-transparent text-sm shadow-xs transition-all',
  nova: 'size-8 border-y border-r border-input bg-transparent text-sm transition-all',
  maia: 'size-9 border-y border-r border-input bg-input/30 text-sm transition-all',
  lyra: 'size-8 border-y border-r rounded-none border-input bg-transparent text-xs transition-all',
  mira: 'size-7 border-y border-r border-input bg-input/20 text-xs leading-relaxed transition-all',
  luma: 'size-9 border-y border-r border-input bg-input/50 text-sm transition-all',
  sera: 'size-10 border rounded-none border-transparent border-b-input bg-transparent text-sm transition-[color,border-color]',
  rhea: 'size-8 border-y border-r border-input bg-input/50 text-sm transition-[color,box-shadow] duration-200',
  'new-york-v4':
    'size-9 border-y border-r border-input bg-transparent text-sm shadow-xs transition-all',
} as const;
const SLOT_FIRST = {
  vega: 'border-l rounded-l-md',
  nova: 'border-l rounded-l-lg',
  maia: 'border-l rounded-l-[var(--pui-radius-4xl)]',
  lyra: 'border-l',
  mira: 'border-l rounded-l-md',
  luma: 'border-l rounded-l-[var(--pui-radius-3xl)]',
  sera: 'rounded-none',
  rhea: 'border-l rounded-l-[var(--pui-radius-2xl)]',
  'new-york-v4': 'border-l rounded-l-md',
} as const;
const SLOT_LAST = {
  vega: 'rounded-r-md',
  nova: 'rounded-r-lg',
  maia: 'rounded-r-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-r-md',
  luma: 'rounded-r-[var(--pui-radius-3xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-r-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-r-md',
} as const;
const SLOT_ACTIVE = {
  vega: 'z-10 border-ring ring-3 ring-ring/50',
  nova: 'z-10 border-ring ring-3 ring-ring/50',
  maia: 'z-10 border-ring ring-3 ring-ring/50',
  lyra: 'z-10 border-ring ring-1 ring-ring/50',
  mira: 'z-10 border-ring ring-2 ring-ring/30',
  luma: 'z-10 border-ring ring-3 ring-ring/30',
  sera: 'z-10 border-b-ring',
  rhea: 'z-10 border-ring ring-3 ring-ring/30',
  'new-york-v4': 'z-10 border-ring ring-3 ring-ring/50',
} as const;
const SLOT_INVALID = {
  vega: 'border-destructive',
  nova: 'border-destructive',
  maia: 'border-destructive',
  lyra: 'border-destructive',
  mira: 'border-destructive',
  luma: 'border-destructive',
  sera: 'border-b-destructive',
  rhea: 'border-destructive',
  'new-york-v4': 'border-destructive',
} as const;
const SLOT_ACTIVE_INVALID = {
  vega: 'z-10 border-destructive ring-3 ring-destructive/20',
  nova: 'z-10 border-destructive ring-3 ring-destructive/20',
  maia: 'z-10 border-destructive ring-3 ring-destructive/20',
  lyra: 'z-10 border-destructive ring-1 ring-destructive/20',
  mira: 'z-10 border-destructive ring-2 ring-destructive/20',
  luma: 'z-10 border-destructive ring-3 ring-destructive/20',
  sera: 'z-10 border-b-destructive',
  rhea: 'z-10 border-destructive ring-3 ring-destructive/20',
  'new-york-v4': 'z-10 border-destructive ring-3 ring-destructive/20',
} as const;

export default definePrototype<ShadcnInputOtpSlotProps, InputOtpSlotExposes>({
  name: 'shadcn-input-otp-slot',
  modules: asInputOtpSlot.modules,
  setup(def) {
    const inherited = asInputOtpSlot();
    const style = setupShadcnStyleSelection(def, 'nova');
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
      first: { type: 'boolean', empty: 'fallback' },
      last: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    const first = def.state.bool('otpVisualFirst', false);
    const last = def.state.bool('otpVisualLast', false);
    const invalid = def.state.bool('otpVisualInvalid', false);
    const disabled = def.state.bool('otpVisualDisabled', false);
    const syncVisual = (run: RunHandle<ShadcnInputOtpSlotProps>) => {
      const p = run.props.get();
      const index = p.index ?? 0;
      const visual = run.context.tryRead(INPUT_OTP_VISUAL);
      const otp = run.context.read(INPUT_OTP_CONTEXT);
      const field = run.context.tryRead(FIELD_CONTEXT);
      const length = visual?.length ?? otp.length;
      first.set(
        run.props.isProvided('first') ? Boolean(p.first) : index === 0,
        'reason: OTP visual first slot'
      );
      last.set(
        run.props.isProvided('last')
          ? Boolean(p.last)
          : length !== undefined && index === length - 1,
        'reason: OTP visual last slot'
      );
      invalid.set(
        Boolean(p.invalid || visual?.invalid || field?.invalid),
        'reason: OTP visual invalid slot'
      );
      disabled.set(Boolean(otp.disabled || visual?.disabled), 'reason: OTP visual disabled slot');
    };
    def.context.trySubscribe(INPUT_OTP_VISUAL, syncVisual);
    def.context.subscribe(INPUT_OTP_CONTEXT, syncVisual);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.props.watch(['index', 'first', 'last', 'invalid'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.feedback.style.use(
      tw(
        'relative inline-flex shrink-0 items-center justify-center tabular-nums text-foreground outline-none'
      )
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(SLOT_SURFACE[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(first).eq(true)),
        intent: (i) => i.feedback.style.use(tw(SLOT_FIRST[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(last).eq(true)),
        intent: (i) => i.feedback.style.use(tw(SLOT_LAST[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.active).eq(true),
            w.state(invalid).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw(SLOT_ACTIVE[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.state(inherited.stateHandles!.active).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw(SLOT_INVALID[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.state(inherited.stateHandles!.active).eq(true)
          ),
        intent: (i) => i.feedback.style.use(tw(SLOT_ACTIVE_INVALID[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'sera'
                ? 'border-b-destructive/50'
                : 'border-destructive/50 ring-destructive/40'
            )
          ),
      });
    }
    for (const profile of ['vega', 'nova', 'lyra', 'mira', 'new-york-v4'] as const) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('bg-input/30')),
      });
    }
    for (const profile of ['maia', 'luma', 'rhea'] as const) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('bg-input/50')),
      });
    }
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
