import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnNumberFieldPartProps } from './types';

/** Proto steppers borrowing the pinned Button outline/icon face; Base still owns stepping. */
const STEP_SURFACE = {
  vega: 'size-9 rounded-md border-border bg-background text-sm shadow-xs',
  nova: 'size-8 rounded-lg border-border bg-background text-sm',
  maia: 'size-9 rounded-[var(--pui-radius-4xl)] border-border bg-input/30 text-sm',
  lyra: 'size-8 rounded-none border-border bg-background text-xs',
  mira: 'size-7 rounded-md border-border bg-transparent text-xs leading-relaxed',
  luma: 'size-9 rounded-[var(--pui-radius-4xl)] border-border bg-background text-sm',
  sera: 'size-10 rounded-none border-border bg-transparent text-xs font-semibold uppercase tracking-widest',
  rhea: 'size-8 rounded-[var(--pui-radius-2xl)] border-border bg-background text-sm',
  'new-york-v4': 'size-9 rounded-md border-border bg-background text-sm shadow-xs',
} as const;
const STEP_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
} as const;
export function setupNumberFieldStepVisual(
  def: DefHandle<ShadcnNumberFieldPartProps>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> }
) {
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center border p-0 text-foreground font-medium outline-none transition-all'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(STEP_SURFACE[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(STEP_FOCUS[profile])),
    });
  }
  for (const profile of ['vega', 'nova', 'lyra', 'mira', 'new-york-v4'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30 border-input')),
    });
  }
  for (const profile of ['luma', 'rhea'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed')),
  });
  return style;
}
