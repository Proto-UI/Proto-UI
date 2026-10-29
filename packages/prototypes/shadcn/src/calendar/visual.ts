import { tw, type DefHandle } from '@proto.ui/core';
import type { CalendarDayContract } from '@proto.ui/prototypes-base/calendar';
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
 * Base is single-date: range segments, week numbers, dropdown captions,
 * multi-month responsive layout and descendant icon recipes are not claimed.
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

export function setupCalendarDayVisual(
  def: DefHandle<ShadcnStyleProps>,
  state: CalendarDayContract['state']
) {
  // Existing content-pinned default remains Nova, separate from New York.
  const style = setupShadcnStyleSelection(def, 'nova');
  def.feedback.style.use(
    tw(
      'relative isolate z-10 inline-flex shrink-0 flex-col items-center justify-center gap-1 border-0 bg-transparent p-0 text-center font-normal leading-none outline-none select-none cursor-pointer transition-all'
    )
  );
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
          w.state(state.today).eq(true),
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
  }
  def.rule({
    when: (w) => w.state(state.selected).eq(true),
    intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
  });
  def.rule({
    when: (w) => w.state(state.outside).eq(true),
    intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none text-muted-foreground opacity-50')),
  });
  def.rule({
    when: (w) => w.state(state.focused).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw('relative z-10 border-ring ring-3 ring-ring/50 forced-colors-focus-outline')
      ),
  });
  return style;
}
