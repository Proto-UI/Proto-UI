import { tw, type DefHandle, type ObservedStateHandle, type StyleHandle } from '@proto.ui/core';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

// The pinned base/ui and independent new-york-v4/ui MessageScroller Button
// uses the same family's secondary Button with icon-sm, with explicit
// background/ink overrides. Jump is the Base end-direction part only.
const SIZE: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('size-8 rounded-[min(var(--radius-md),10px)] text-sm font-medium'),
  nova: tw('size-7 rounded-[min(var(--radius-md),12px)] text-sm font-medium'),
  maia: tw('size-8 rounded-[var(--pui-radius-4xl)] text-sm font-medium'),
  lyra: tw('size-7 rounded-none text-xs font-medium'),
  mira: tw('size-6 rounded-md text-xs leading-relaxed font-medium'),
  luma: tw('size-8 rounded-[var(--pui-radius-4xl)] text-sm font-medium'),
  sera: tw('size-9 rounded-none text-xs font-semibold uppercase tracking-widest'),
  rhea: tw('size-7 rounded-[var(--pui-radius-2xl)] text-sm font-medium'),
  'new-york-v4': tw('size-8 rounded-md text-sm font-medium'),
};

type ButtonFacts = {
  hovered: ObservedStateHandle<boolean, any>;
  pressed: ObservedStateHandle<boolean, any>;
  focusVisible: ObservedStateHandle<boolean, any>;
  disabled: ObservedStateHandle<boolean, any>;
};

export function setupMessageJumpPaint(def: DefHandle<ShadcnStyleProps>, state: ButtonFacts) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(
    tw(
      'absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex shrink-0 items-center justify-center border-border bg-background text-foreground outline-none select-none transition-all duration-200'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(SIZE[profile]),
    });
  }
  def.rule({
    when: (w) => w.not(w.state(style).eq('new-york-v4')),
    intent: (i) => i.feedback.style.use(tw('border bg-clip-padding')),
  });
  def.rule({
    when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.state(style).eq('lyra')
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-1 ring-ring/50 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('mira'), w.state(style).eq('sera'))
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-2 ring-ring/30 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.any(
          w.state(style).eq('vega'),
          w.state(style).eq('nova'),
          w.state(style).eq('maia'),
          w.state(style).eq('new-york-v4')
        )
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-3 ring-ring/50 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.focusVisible).eq(true),
        w.state(state.disabled).eq(false),
        w.any(w.state(style).eq('luma'), w.state(style).eq('rhea'))
      ),
    intent: (i) =>
      i.feedback.style.use(tw('border-ring ring-3 ring-ring/30 forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.pressed).eq(true),
        w.state(state.disabled).eq(false),
        w.not(w.state(style).eq('new-york-v4'))
      ),
    intent: (i) => i.feedback.style.use(tw('translate-y-px')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
  });
  // No opacity, pointer or tab suppression is fabricated from atEnd: the
  // upstream active fact includes scrollability plus follow policy, and Base
  // does not yet expose the required interaction/focus eligibility contract.
}
