import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asInputOtpSlot } from '@proto.ui/prototypes-base/input-otp';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnInputOtpSlotProps } from './types';
import { INPUT_OTP_VISUAL } from './visual';

/** Source .cn-input-otp-slot; endpoints describe the full-code segment, not split groups. */
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
export default definePrototype<ShadcnInputOtpSlotProps, InputOtpSlotExposes>({
  name: 'shadcn-input-otp-slot',
  modules: asInputOtpSlot.modules,
  setup(def) {
    const inherited = asInputOtpSlot();
    const style = setupShadcnStyleSelection(def, 'nova');
    const first = def.state.bool('otpVisualFirst', false);
    const last = def.state.bool('otpVisualLast', false);
    const syncEndpoints = (run: RunHandle<ShadcnInputOtpSlotProps>) => {
      const index = run.props.get().index!;
      const length = run.context.tryRead(INPUT_OTP_VISUAL)?.length;
      first.set(index === 0, 'reason: OTP visual first slot');
      last.set(length !== undefined && index === length - 1, 'reason: OTP visual last slot');
    };
    def.context.trySubscribe(INPUT_OTP_VISUAL, syncEndpoints);
    def.props.watch(['index'], syncEndpoints);
    def.lifecycle.onCreated(syncEndpoints);
    def.lifecycle.onMounted(syncEndpoints);
    def.lifecycle.onUpdated(syncEndpoints);
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
          w.all(w.state(style).eq(profile), w.state(inherited.stateHandles!.active).eq(true)),
        intent: (i) => i.feedback.style.use(tw(SLOT_ACTIVE[profile])),
      });
    }
    for (const profile of ['vega', 'nova', 'lyra', 'mira', 'new-york-v4'] as const) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('bg-input/30')),
      });
    }
    return inherited.render;
  },
});
