import { tw, type DefHandle, type State } from '@proto.ui/core';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

/** MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * bases/base/ui/button.tsx + styles/style-*.css .cn-button/-outline/-ghost,
 * and the independent new-york-v4/ui/button.tsx at the same revision.
 * This is paint shared by collection controls, not another asButton invocation.
 * Toolbar and Tree remain Proto extensions, not official upstream components.
 * Descendant glyph and invalid-selector parity are intentionally not inferred.
 */
const ACTION_PROFILE = {
  vega: 'rounded-md border border-transparent bg-clip-padding text-sm font-medium',
  nova: 'rounded-lg border border-transparent bg-clip-padding text-sm font-medium',
  maia: 'rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  lyra: 'rounded-none border border-transparent bg-clip-padding text-xs font-medium',
  mira: 'rounded-md border border-transparent bg-clip-padding text-xs leading-relaxed font-medium',
  luma: 'rounded-[var(--pui-radius-4xl)] border border-transparent bg-clip-padding text-sm font-medium',
  sera: 'rounded-none border border-transparent bg-clip-padding text-xs font-semibold uppercase tracking-widest',
  rhea: 'rounded-[var(--pui-radius-2xl)] border border-transparent bg-clip-padding text-sm font-medium',
  'new-york-v4': 'rounded-md text-sm font-medium',
} as const satisfies Record<ShadcnStyleId, string>;
const ACTION_SIZE = {
  vega: 'h-9 gap-1.5 px-2.5',
  nova: 'h-8 gap-1.5 px-2.5',
  maia: 'h-9 gap-1.5 px-3',
  lyra: 'h-8 gap-1.5 px-2.5',
  mira: 'h-7 gap-1 px-2',
  luma: 'h-9 gap-1.5 px-3',
  sera: 'h-10 gap-1.5 px-6',
  rhea: 'h-8 gap-1.5 px-3',
  'new-york-v4': 'h-9 gap-2 px-4 py-2',
} as const satisfies Record<ShadcnStyleId, string>;
const ACTION_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
} as const satisfies Record<ShadcnStyleId, string>;
const OUTLINE = {
  vega: 'border border-border bg-background shadow-xs',
  nova: 'border border-border bg-background',
  maia: 'border border-border bg-input/30',
  lyra: 'border border-border bg-background',
  mira: 'border border-border bg-transparent',
  luma: 'border border-border bg-background',
  sera: 'border border-border bg-transparent',
  rhea: 'border border-border bg-background',
  'new-york-v4': 'border border-border bg-background shadow-xs',
} as const satisfies Record<ShadcnStyleId, string>;

/** Local pointer paint only. No Trigger, focus, selection or activation owner. */
export function setupCollectionHover(def: DefHandle, disabled?: State<boolean>) {
  const hovered = def.state.bool('collectionPointerPaint', false);
  const clear = () => hovered.set(false, 'collection pointer paint reset');
  def.event.on('pointer.enter', () => {
    if (!disabled?.get()) hovered.set(true, 'collection pointer paint enter');
  });
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.lifecycle.onUnmounted(clear);
  disabled?.watch((_run, event) => {
    if (event.type === 'next' && event.next) clear();
  });
  return hovered;
}

export function setupCollectionActionVisual(
  def: DefHandle<ShadcnStyleProps>,
  state: {
    disabled: State<boolean>;
    focusVisible: State<boolean>;
    hovered?: State<boolean>;
    pressed?: State<boolean>;
    open?: State<boolean>;
  },
  variant: 'outline' | 'ghost',
  calendarCell = false,
  hasPopup = false
) {
  const style = setupShadcnStyleSelection(def, 'nova');
  const hovered = state.hovered ?? setupCollectionHover(def, state.disabled);
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none text-foreground'
    )
  );
  if (variant === 'ghost') def.feedback.style.use(tw('bg-transparent'));
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(ACTION_PROFILE[profile])),
    });
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            calendarCell
              ? profile === 'mira'
                ? 'h-6 w-6 p-0'
                : profile === 'nova' || profile === 'lyra'
                  ? 'h-7 w-7 p-0'
                  : 'h-8 w-8 p-0'
              : ACTION_SIZE[profile]
          )
        ),
    });
    if (variant === 'outline') {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(OUTLINE[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'maia'
                ? 'bg-input/30'
                : profile === 'luma' || profile === 'rhea' || profile === 'sera'
                  ? 'bg-transparent'
                  : profile === 'mira'
                    ? 'bg-input/30'
                    : 'bg-input/30 border-input'
            )
          ),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'new-york-v4'
              ? 'bg-accent text-accent-foreground'
              : variant === 'outline' && (profile === 'maia' || profile === 'mira')
                ? 'bg-input/50 text-foreground'
                : 'bg-muted text-foreground'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            variant === 'ghost'
              ? profile === 'new-york-v4'
                ? 'bg-accent/50'
                : 'bg-muted/50'
              : profile === 'maia' ||
                  profile === 'mira' ||
                  profile === 'vega' ||
                  profile === 'nova' ||
                  profile === 'lyra' ||
                  profile === 'new-york-v4'
                ? 'bg-input/50'
                : 'bg-input/30'
          )
        ),
    });
    if (state.open && profile !== 'new-york-v4') {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.open!).eq(true)),
        intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
      });
    }
    // aria-haspopup controls do not have the modern pressed translation.
    if (state.pressed && !hasPopup && profile !== 'new-york-v4') {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.pressed!).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('translate-y-px')),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(ACTION_FOCUS[profile])),
    });
  }
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
  return style;
}
