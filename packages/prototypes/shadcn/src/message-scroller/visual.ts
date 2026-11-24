import { tw, type DefHandle, type State, type StyleHandle } from '@proto.ui/core';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

export type ShadcnMessageScrollerJumpSize = 'icon' | 'pill';

export type ShadcnMessageScrollerJumpVisualProps = ShadcnStyleProps & {
  size?: ShadcnMessageScrollerJumpSize;
};

// The pinned base/ui and independent new-york-v4/ui MessageScroller Button
// uses the same family's secondary Button with icon-sm by default, plus an
// opt-in pill size for text labels and newContentCount badges. Jump is the
// Base end-direction part only.
const ICON_SIZE: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('size-8 rounded-[min(var(--pui-radius-md),10px)] text-sm font-medium'),
  nova: tw('size-7 rounded-[min(var(--radius-md),12px)] text-sm font-medium'),
  maia: tw('size-8 rounded-[var(--pui-radius-4xl)] text-sm font-medium'),
  lyra: tw('size-7 rounded-none text-xs font-medium'),
  mira: tw('size-6 rounded-md text-xs leading-relaxed font-medium'),
  luma: tw('size-8 rounded-[var(--pui-radius-4xl)] text-sm font-medium'),
  sera: tw('size-9 rounded-none text-xs font-semibold uppercase tracking-widest'),
  rhea: tw('size-7 rounded-[var(--pui-radius-2xl)] text-sm font-medium'),
  'new-york-v4': tw('size-8 rounded-md text-sm font-medium'),
};

const PILL_SIZE: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('h-8 px-3 gap-1.5 rounded-[min(var(--pui-radius-md),10px)] text-sm font-medium'),
  nova: tw('h-7 px-2.5 gap-1.5 rounded-[min(var(--radius-md),12px)] text-sm font-medium'),
  maia: tw('h-8 px-3 gap-1.5 rounded-[var(--pui-radius-4xl)] text-sm font-medium'),
  lyra: tw('h-7 px-2.5 gap-1.5 rounded-none text-xs font-medium'),
  mira: tw('h-6 px-2 gap-1 rounded-md text-xs leading-relaxed font-medium'),
  luma: tw('h-8 px-3 gap-1.5 rounded-[var(--pui-radius-4xl)] text-sm font-medium'),
  sera: tw('h-9 px-3.5 gap-1.5 rounded-none text-xs font-semibold uppercase tracking-widest'),
  rhea: tw('h-7 px-2.5 gap-1.5 rounded-[var(--pui-radius-2xl)] text-sm font-medium'),
  'new-york-v4': tw('h-8 px-3 gap-1.5 rounded-md text-sm font-medium'),
};

type ButtonFacts = {
  hovered: State<boolean>;
  pressed: State<boolean>;
  focusVisible: State<boolean>;
  disabled: State<boolean>;
};

export function setupMessageJumpPaint<
  Props extends ShadcnMessageScrollerJumpVisualProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, state: ButtonFacts) {
  def.props.define({
    size: { type: 'enum', options: ['icon', 'pill'], empty: 'fallback' },
  } as any);
  def.props.setDefaults({ size: 'icon' } as any);
  const style = setupShadcnStyleSelection(def, 'new-york-v4');
  def.feedback.style.use(
    tw(
      'absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex shrink-0 items-center justify-center border border-border bg-background bg-clip-padding text-foreground shadow-sm outline-none select-none whitespace-nowrap cursor-pointer transition-all duration-200'
    )
  );
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('icon' as any)),
      intent: (i) => i.feedback.style.use(ICON_SIZE[profile]),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq('pill' as any)),
      intent: (i) => i.feedback.style.use(PILL_SIZE[profile]),
    });
  }
  for (const profile of ['luma', 'rhea'] as const) {
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-foreground/10')),
    });
  }
  def.rule({
    when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
    intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground shadow-md')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.meta('colorScheme').eq('dark')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground shadow-md')),
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
    intent: (i) =>
      i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default shadow-none')),
  });
  // No opacity, pointer or tab suppression is fabricated from atEnd: the
  // upstream active fact includes scrollability plus follow policy, and Base
  // does not yet expose the required interaction/focus eligibility contract.
}
