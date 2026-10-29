import { definePrototype, tw } from '@proto.ui/core';
import {
  asDatePickerRoot,
  asDatePickerTrigger,
  asDatePickerContent,
  asDatePickerDay,
  asDatePickerValue,
  type DatePickerRootProps,
  type DatePickerRootExposes,
  type DatePickerTriggerProps,
  type DatePickerTriggerExposes,
  type DatePickerContentProps,
  type DatePickerContentExposes,
  type DatePickerDayProps,
  type DatePickerDayExposes,
  type DatePickerValueProps,
  type DatePickerValueExposes,
} from '@proto.ui/prototypes-base/date-picker';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';
import { setupCalendarDayVisual } from '../calendar/visual';
import { setupCollectionActionVisual } from '../toolbar/action-visual';
export type * from '@proto.ui/prototypes-base/date-picker';
export type ShadcnDatePickerRootProps = DatePickerRootProps & ShadcnStyleProps;
export type ShadcnDatePickerTriggerProps = DatePickerTriggerProps & ShadcnStyleProps;
export type ShadcnDatePickerContentProps = DatePickerContentProps & ShadcnStyleProps;
export type ShadcnDatePickerDayProps = DatePickerDayProps & ShadcnStyleProps;
export type ShadcnDatePickerValueProps = DatePickerValueProps & ShadcnStyleProps;

/** Proto composition, not an upstream standalone DatePicker API.
 * MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7:
 * bases/base/ui/{button,popover,calendar}.tsx, style-*.css .cn-popover-content,
 * and the separately read new-york-v4/ui/{button,popover,calendar}.tsx.
 * Root/Value are semantic composition owners, not additional popup surfaces.
 * Content omits source popup padding because Calendar owns its own padding.
 * Source portal/side motion and trigger expanded paint remain separate gaps.
 */
const POPUP_PROFILE = {
  vega: 'rounded-md ring-1 ring-foreground/10 shadow-md text-sm',
  nova: 'rounded-lg ring-1 ring-foreground/10 shadow-md text-sm',
  maia: 'rounded-[var(--pui-radius-2xl)] ring-1 ring-foreground/5 shadow-2xl text-sm',
  lyra: 'rounded-none ring-1 ring-foreground/10 shadow-md text-xs',
  mira: 'rounded-lg ring-1 ring-foreground/10 shadow-md text-xs',
  luma: 'rounded-[var(--pui-radius-3xl)] ring-1 ring-foreground/5 shadow-lg text-sm',
  sera: 'rounded-none ring-1 ring-foreground/10 shadow-md text-sm',
  rhea: 'rounded-[var(--pui-radius-3xl)] ring-1 ring-foreground/5 shadow-lg text-sm',
  'new-york-v4': 'rounded-md border border-border shadow-md text-sm',
} as const satisfies Record<ShadcnStyleId, string>;

export const datePickerRoot = definePrototype<ShadcnDatePickerRootProps, DatePickerRootExposes>({
  name: 'shadcn-date-picker-root',
  setup(def) {
    const behavior = asDatePickerRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('inline-grid min-w-0 max-w-full text-foreground'));
    return behavior.render;
  },
});
export { datePickerRoot as shadcnDatePickerRoot };

export const datePickerTrigger = definePrototype<
  ShadcnDatePickerTriggerProps,
  DatePickerTriggerExposes
>({
  name: 'shadcn-date-picker-trigger',
  setup(def) {
    const behavior = asDatePickerTrigger();
    const state = behavior.getAsHookHandle?.('as-popover-trigger')?.stateHandles;
    if (!state) throw new Error('[shadcn-date-picker] Trigger state unavailable.');
    setupCollectionActionVisual(def, state, 'outline', false, true);
    return behavior.render;
  },
});
export { datePickerTrigger as shadcnDatePickerTrigger };

export const datePickerContent = definePrototype<
  ShadcnDatePickerContentProps,
  DatePickerContentExposes
>({
  name: 'shadcn-date-picker-content',
  setup(def) {
    const behavior = asDatePickerContent();
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(
      tw('z-50 w-auto min-w-0 max-w-full bg-popover p-0 text-popover-foreground outline-none')
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(POPUP_PROFILE[profile])),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.state(style).eq('luma'), w.state(style).eq('rhea')),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
    return behavior.render;
  },
});
export { datePickerContent as shadcnDatePickerContent };

export const datePickerDay = definePrototype<ShadcnDatePickerDayProps, DatePickerDayExposes>({
  name: 'shadcn-date-picker-day',
  setup(def) {
    const behavior = asDatePickerDay();
    const state = behavior.getAsHookHandle?.('as-calendar-day')?.stateHandles;
    if (!state) throw new Error('[shadcn-date-picker] Day state unavailable.');
    setupCalendarDayVisual(def, state);
    return behavior.render;
  },
});
export { datePickerDay as shadcnDatePickerDay };

export const datePickerValue = definePrototype<ShadcnDatePickerValueProps, DatePickerValueExposes>({
  name: 'shadcn-date-picker-value',
  setup(def) {
    const behavior = asDatePickerValue();
    setupShadcnStyleSelection(def, 'nova');
    // Text inherits its actual Trigger's typography, including Mira and Sera.
    def.feedback.style.use(tw('min-w-0'));
    return behavior.render;
  },
});
export { datePickerValue as shadcnDatePickerValue };
