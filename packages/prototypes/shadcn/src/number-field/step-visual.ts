import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import { setupCollectionHover } from '../toolbar/action-visual';
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
  rhea: 'size-8 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 text-sm',
  'new-york-v4': 'size-9 rounded-md border-border bg-background text-sm shadow-xs',
} as const;
const STEP_HOVER = {
  vega: 'bg-accent text-accent-foreground',
  nova: 'bg-accent text-accent-foreground',
  maia: 'bg-muted text-foreground',
  lyra: 'bg-accent text-accent-foreground',
  mira: 'bg-muted text-foreground',
  luma: 'bg-muted text-foreground',
  sera: 'bg-muted text-foreground',
  rhea: 'bg-muted text-foreground',
  'new-york-v4': 'bg-accent text-accent-foreground',
} as const;
const STEP_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
  nova: 'border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
  maia: 'border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
  lyra: 'border-ring ring-1 ring-ring/50 forced-colors-focus-outline',
  mira: 'border-ring ring-2 ring-ring/30 forced-colors-focus-outline',
  luma: 'border-ring ring-3 ring-ring/30 forced-colors-focus-outline',
  sera: 'border-ring ring-2 ring-ring/30 forced-colors-focus-outline',
  rhea: 'border-ring ring-3 ring-ring/30 forced-colors-focus-outline',
  'new-york-v4': 'border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
} as const;
export function setupNumberFieldStepVisual(
  def: DefHandle<ShadcnNumberFieldPartProps>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> }
) {
  const style = setupShadcnStyleSelection(def, 'nova');
  const hovered = setupCollectionHover(def, state.disabled);
  const pressed = def.state.bool('stepPointerPressed', false);
  const clearPressed = () => pressed.set(false, 'reason: step pointer press ended');
  def.event.on('pointer.down', () => {
    if (!state.disabled.get()) pressed.set(true, 'reason: step pointer down');
  });
  def.event.on('pointer.up', clearPressed);
  def.event.on('pointer.leave', clearPressed);
  def.event.on('pointer.cancel', clearPressed);
  def.lifecycle.onUnmounted(clearPressed);
  if ('watch' in state.disabled) {
    state.disabled.watch((_run, event) => {
      if (event.type === 'next' && event.next) clearPressed();
    });
  }
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center border p-0 text-foreground font-medium outline-none select-none cursor-pointer transition-colors'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(STEP_SURFACE[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw(STEP_HOVER[profile])),
    });
  }
  for (const profile of ['vega', 'nova', 'maia', 'lyra', 'mira', 'new-york-v4'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30 border-input')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
  }
  for (const profile of ['luma', 'sera'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-transparent border-input')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
  }
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.meta('colorScheme').eq('dark')),
    intent: (i) => i.feedback.style.use(tw('bg-input/30 border-transparent')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('rhea'),
        w.meta('colorScheme').eq('dark'),
        w.state(hovered).eq(true)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/50')),
  });
  def.rule({
    when: (w) => w.all(w.state(pressed).eq(true), w.not(w.state(style).eq('new-york-v4'))),
    intent: (i) => i.feedback.style.use(tw('translate-y-px')),
  });
  def.rule({
    when: (w) => w.all(w.state(pressed).eq(true), w.state(style).eq('new-york-v4')),
    intent: (i) => i.feedback.style.use(tw('bg-accent/80')),
  });
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(STEP_FOCUS[profile])),
    });
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed')),
  });
  return style;
}
