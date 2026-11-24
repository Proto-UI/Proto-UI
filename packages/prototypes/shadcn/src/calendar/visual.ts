import { tw, type DefHandle, type State } from '@proto.ui/core';
import type {
  CalendarDayContract,
  CalendarPreviousExposes,
  CalendarPreviousProps,
} from '@proto.ui/prototypes-base/calendar';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

/** MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7:
 * bases/base/ui/calendar.tsx and styles/style-*.css .cn-calendar;
 * new-york-v4/ui/calendar.tsx is an independently read source, not Nova.
 * --spacing(6/7/8) remains 1.5/1.75/2rem through finite spacing tokens.
 * Base selection covers single, multiple and inclusive range segments. Week numbers, dropdown captions,
 * multi-month responsive layout and descendant icon recipes are not claimed.
 * The existing unscoped Nova comparison remains separately bound to the
 * 2026-10-10 base-nova/calendar.json snapshot, SHA256
 * cc9ff16599d1664cec2d6a91ba82d0927953d8eedd51a7d56bba48a6522c28eb.
 * Its p-2 / 1.75rem cells are not a New York baseline.
 */
export const CALENDAR_ROOT_PROFILE = {
  vega: 'p-3',
  nova: 'p-2',
  maia: 'p-3',
  lyra: 'p-2',
  mira: 'p-3',
  luma: 'p-3',
  sera: 'p-3',
  rhea: 'p-3',
  'new-york-v4': 'p-3',
} as const satisfies Record<ShadcnStyleId, string>;
export const CALENDAR_CELL_SIZE = {
  vega: 'h-8 w-8',
  nova: 'h-7 w-7',
  maia: 'h-8 w-8',
  lyra: 'h-7 w-7',
  mira: 'h-6 w-6',
  luma: 'h-8 w-8',
  sera: 'h-8 w-8',
  rhea: 'h-8 w-8',
  'new-york-v4': 'h-8 w-8',
} as const satisfies Record<ShadcnStyleId, string>;
export const CALENDAR_WEEKDAY_WIDTH = {
  vega: 'w-8',
  nova: 'w-7',
  maia: 'w-8',
  lyra: 'w-7',
  mira: 'w-6',
  luma: 'w-8',
  sera: 'w-8',
  rhea: 'w-8',
  'new-york-v4': 'w-8',
} as const satisfies Record<ShadcnStyleId, string>;
export const CALENDAR_CAPTION_SIZE = {
  vega: 'h-8',
  nova: 'h-7',
  maia: 'h-8',
  lyra: 'h-7',
  mira: 'h-6',
  luma: 'h-8',
  sera: 'h-8',
  rhea: 'h-8',
  'new-york-v4': 'h-8',
} as const satisfies Record<ShadcnStyleId, string>;
export const CALENDAR_CELL_RADIUS = {
  vega: 'rounded-md',
  nova: 'rounded-md',
  maia: 'rounded-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-md',
  luma: 'rounded-[var(--pui-radius-4xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-md',
} as const satisfies Record<ShadcnStyleId, string>;
const DAY_PROFILE = {
  vega: 'rounded-md text-sm',
  nova: 'rounded-lg text-sm',
  maia: 'rounded-[var(--pui-radius-4xl)] text-sm',
  lyra: 'rounded-none text-xs',
  mira: 'rounded-md text-xs',
  luma: 'rounded-[var(--pui-radius-4xl)] text-sm',
  sera: 'rounded-none text-xs uppercase tracking-widest',
  rhea: 'rounded-[var(--pui-radius-2xl)] text-sm',
  'new-york-v4': 'rounded-md text-sm',
} as const satisfies Record<ShadcnStyleId, string>;
const DAY_RANGE_START_RADIUS = {
  vega: 'rounded-none rounded-l-md',
  nova: 'rounded-none rounded-l-lg',
  maia: 'rounded-none rounded-l-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-none rounded-l-md',
  luma: 'rounded-none rounded-l-[var(--pui-radius-4xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-none rounded-l-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-none rounded-l-md',
} as const satisfies Record<ShadcnStyleId, string>;
const DAY_RANGE_END_RADIUS = {
  vega: 'rounded-none rounded-r-md',
  nova: 'rounded-none rounded-r-lg',
  maia: 'rounded-none rounded-r-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-none rounded-r-md',
  luma: 'rounded-none rounded-r-[var(--pui-radius-4xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-none rounded-r-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-none rounded-r-md',
} as const satisfies Record<ShadcnStyleId, string>;
const DAY_FOCUS = {
  vega: 'relative z-10 border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
  nova: 'relative z-10 border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
  maia: 'relative z-10 border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
  lyra: 'relative z-10 border-ring ring-1 ring-ring/50 forced-colors-focus-outline',
  mira: 'relative z-10 border-ring ring-2 ring-ring/30 forced-colors-focus-outline',
  luma: 'relative z-10 border-ring ring-3 ring-ring/30 forced-colors-focus-outline',
  sera: 'relative z-10 border-ring ring-2 ring-ring/30 forced-colors-focus-outline',
  rhea: 'relative z-10 border-ring ring-3 ring-ring/30 forced-colors-focus-outline',
  'new-york-v4': 'relative z-10 border-ring ring-3 ring-ring/50 forced-colors-focus-outline',
} as const satisfies Record<ShadcnStyleId, string>;

const NAV_PROFILE = {
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

const NAV_OUTLINE = {
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

export type ShadcnCalendarButtonVariant = 'ghost' | 'outline';
export type ShadcnCalendarNavProps = CalendarPreviousProps &
  ShadcnStyleProps & {
    buttonVariant?: ShadcnCalendarButtonVariant;
  };

export function setupCalendarDayVisual<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>, state: CalendarDayContract['state']) {
  // Existing content-pinned default remains Nova, separate from New York.
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(
    tw(
      'relative isolate z-10 inline-flex shrink-0 flex-col items-center justify-center gap-1 border-0 p-0 text-center font-normal leading-none outline-none select-none cursor-pointer transition-all'
    )
  );
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(false),
        w.state(state.today).eq(false),
        w.any(w.state(state.disabled).eq(true), w.state(state.hovered).eq(false))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-transparent')),
  });
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(CALENDAR_CELL_SIZE[profile])),
    });
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(DAY_PROFILE[profile])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.rangeStart).eq(true),
          w.state(state.rangeEnd).eq(false),
          w.state(state.rangePending).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(DAY_RANGE_START_RADIUS[profile])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.rangeEnd).eq(true),
          w.state(state.rangeStart).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(DAY_RANGE_END_RADIUS[profile])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.today).eq(true),
          w.state(state.selected).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'new-york-v4'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'bg-muted text-foreground font-medium'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'new-york-v4'
              ? 'bg-accent text-accent-foreground'
              : 'bg-muted text-foreground'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'new-york-v4'
              ? 'bg-accent/50 text-accent-foreground'
              : 'bg-muted/50 text-foreground'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(DAY_FOCUS[profile])),
    });
  }
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(true),
        w.state(state.rangeMiddle).eq(false),
        w.state(state.rangePending).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
  });
  def.rule({
    when: (w) => w.state(state.rangePending).eq(true),
    intent: (i) =>
      i.feedback.style.use(tw('bg-primary/90 text-primary-foreground ring-2 ring-ring/50')),
  });
  def.rule({
    when: (w) => w.state(state.rangeMiddle).eq(true),
    intent: (i) => i.feedback.style.use(tw('rounded-none bg-accent text-accent-foreground')),
  });
  // Pressed keeps the family's command vocabulary: New York has no press
  // translation; every other profile shares the modern translate-y-px.
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.pressed).eq(true),
        w.state(state.disabled).eq(false),
        w.state(state.selected).eq(false),
        w.not(w.state(style).eq('new-york-v4'))
      ),
    intent: (i) => i.feedback.style.use(tw('translate-y-px')),
  });
  def.rule({
    when: (w) => w.all(w.state(state.outside).eq(true), w.state(state.selected).eq(false)),
    intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none text-muted-foreground opacity-50')),
  });
  return style;
}

export function setupCalendarNavVisual(
  def: DefHandle<ShadcnCalendarNavProps, CalendarPreviousExposes>,
  state: {
    disabled: State<boolean>;
    focusVisible: State<boolean>;
    hovered: State<boolean>;
    pressed: State<boolean>;
  }
) {
  def.props.define({
    buttonVariant: { type: 'enum', options: ['ghost', 'outline'], empty: 'fallback' },
  });
  def.props.setDefaults({ buttonVariant: 'ghost' });
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(
    tw(
      'inline-flex shrink-0 items-center justify-center p-0 whitespace-nowrap transition-all outline-none select-none cursor-pointer text-foreground'
    )
  );
  def.rule({
    when: (w) =>
      w.all(
        w.prop('buttonVariant').eq('ghost'),
        w.any(w.state(state.disabled).eq(true), w.state(state.hovered).eq(false))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-transparent')),
  });
  for (const profile of SHADCN_STYLE_IDS) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(NAV_PROFILE[profile])),
    });
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(CALENDAR_CELL_SIZE[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('buttonVariant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw(NAV_OUTLINE[profile])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.prop('buttonVariant').eq('outline'),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'maia' || profile === 'mira'
              ? 'bg-input/30'
              : profile === 'luma' || profile === 'rhea' || profile === 'sera'
                ? 'bg-transparent'
                : 'bg-input/30 border-input'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.prop('buttonVariant').eq('ghost')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'new-york-v4'
              ? 'bg-accent text-accent-foreground'
              : 'bg-muted text-foreground'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.prop('buttonVariant').eq('outline')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'new-york-v4'
              ? 'bg-accent text-accent-foreground'
              : profile === 'maia' || profile === 'mira'
                ? 'bg-input/50 text-foreground'
                : 'bg-muted text-foreground'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.meta('colorScheme').eq('dark'),
          w.prop('buttonVariant').eq('ghost')
        ),
      intent: (i) =>
        i.feedback.style.use(tw(profile === 'new-york-v4' ? 'bg-accent/50' : 'bg-muted/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.meta('colorScheme').eq('dark'),
          w.prop('buttonVariant').eq('outline')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            profile === 'maia' ||
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
    if (profile !== 'new-york-v4') {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.pressed).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('translate-y-px')),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(DAY_FOCUS[profile])),
    });
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
  });
  return style;
}
