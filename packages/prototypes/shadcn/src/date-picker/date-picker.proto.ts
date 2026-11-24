import { createContextKey, definePrototype, tw, type RunHandle } from '@proto.ui/core';
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
import { CALENDAR_ROOT_PROFILE, setupCalendarDayVisual } from '../calendar/visual';
import { setupCollectionActionVisual } from '../toolbar/action-visual';
import { setupPopupMotion } from '../popover/motion';
export type * from '@proto.ui/prototypes-base/date-picker';
export type ShadcnDatePickerRootProps = DatePickerRootProps & ShadcnStyleProps;
export type ShadcnDatePickerTriggerProps = DatePickerTriggerProps & ShadcnStyleProps;
export type ShadcnDatePickerContentProps = DatePickerContentProps & ShadcnStyleProps;
export type ShadcnDatePickerDayProps = DatePickerDayProps & ShadcnStyleProps;
export type ShadcnDatePickerValueProps = DatePickerValueProps;

const DATE_PICKER_PRESENTATION = createContextKey<{ open: boolean; empty: boolean }>(
  'shadcn-date-picker-presentation'
);

/** Proto composition, not an upstream standalone DatePicker API.
 * MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7:
 * bases/base/ui/{button,popover,calendar}.tsx, style-*.css .cn-popover-content,
 * and the separately read new-york-v4/ui/{button,popover,calendar}.tsx.
 * Root/Value are semantic composition owners, not additional popup surfaces.
 * Content realizes Calendar's padding on the existing popup host. It does not
 * instantiate another Calendar Root or add the generic Popover's padding too.
 * Source portal/side motion remains a separate acceptance axis.
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
  modules: asDatePickerRoot.modules,
  setup(def) {
    const behavior = asDatePickerRoot();
    const calendar = behavior.getAsHookHandle?.('as-calendar-root')?.stateHandles;
    const open = behavior.getAsHookHandle?.('as-popover-root')?.getAsHookHandle?.('useOpenState')
      ?.stateHandles?.open;
    if (!calendar || !open) throw new Error('[shadcn-date-picker] Root facts unavailable.');
    def.context.provide(DATE_PICKER_PRESENTATION, { open: false, empty: true });
    def.context.subscribe(DATE_PICKER_PRESENTATION);
    const syncPresentation = (run: RunHandle<ShadcnDatePickerRootProps>) => {
      const nextOpen = open.get();
      const nextEmpty = calendar.selectedCount.get() === 0;
      const current = run.context.read(DATE_PICKER_PRESENTATION);
      if (current.open !== nextOpen || current.empty !== nextEmpty) {
        run.context.update(DATE_PICKER_PRESENTATION, { open: nextOpen, empty: nextEmpty });
      }
    };
    open.watch((run, event) => {
      if (event.type === 'next') syncPresentation(run);
    });
    calendar.selectedCount.watch((run, event) => {
      if (event.type === 'next') syncPresentation(run);
    });
    def.lifecycle.onCreated(syncPresentation);
    def.lifecycle.onMounted(syncPresentation);
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('inline-grid min-w-0 max-w-full text-foreground'));
    def.rule({
      when: (w) => w.state(calendar.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    def.rule({
      when: (w) => w.state(calendar.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return behavior.render;
  },
});
export { datePickerRoot as shadcnDatePickerRoot };

export const datePickerTrigger = definePrototype<
  ShadcnDatePickerTriggerProps,
  DatePickerTriggerExposes
>({
  name: 'shadcn-date-picker-trigger',
  modules: asDatePickerTrigger.modules,
  setup(def) {
    const behavior = asDatePickerTrigger();
    const state = behavior.getAsHookHandle?.('as-popover-trigger')?.stateHandles;
    if (!state) throw new Error('[shadcn-date-picker] Trigger state unavailable.');
    const open = def.state.bool('datePickerExpandedPaint', false);
    const empty = def.state.bool('datePickerEmptyPaint', true);
    const syncPresentation = (run: RunHandle<ShadcnDatePickerTriggerProps>) => {
      const presentation = run.context.tryRead(DATE_PICKER_PRESENTATION);
      open.set(presentation?.open ?? false, 'date picker observed open');
      empty.set(presentation?.empty ?? true, 'date picker observed empty');
    };
    def.context.trySubscribe(DATE_PICKER_PRESENTATION, syncPresentation);
    def.lifecycle.onCreated(syncPresentation);
    def.lifecycle.onMounted(syncPresentation);
    const style = setupCollectionActionVisual(
      def,
      {
        disabled: state.disabled,
        focusVisible: state.focusVisible,
        hovered: state.hovered,
        pressed: state.pressed,
        open,
      },
      'outline',
      false,
      true
    );
    def.feedback.style.use(tw('justify-between text-start cursor-pointer'));
    def.rule({
      when: (w) => w.not(w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('font-normal')),
    });
    def.rule({
      when: (w) => w.all(w.state(empty).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return behavior.render;
  },
});
export { datePickerTrigger as shadcnDatePickerTrigger };

export const datePickerContent = definePrototype<
  ShadcnDatePickerContentProps,
  DatePickerContentExposes
>({
  name: 'shadcn-date-picker-content',
  modules: asDatePickerContent.modules,
  setup(def) {
    const behavior = asDatePickerContent();
    const open = behavior.getAsHookHandle?.('as-popover-content')?.stateHandles?.open;
    if (!open) throw new Error('[shadcn-date-picker] Content open state unavailable.');
    setupPopupMotion(def, open);
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(
      tw(
        'z-50 grid w-auto min-w-0 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-hidden gap-2 bg-popover text-popover-foreground outline-none'
      )
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(POPUP_PROFILE[profile])),
      });
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(CALENDAR_ROOT_PROFILE[profile])),
      });
    }
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('duration-100')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.state(style).eq('luma'), w.state(style).eq('rhea')),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-foreground/10')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('animate-none transition-none')),
    });
    return behavior.render;
  },
});
export { datePickerContent as shadcnDatePickerContent };

export const datePickerDay = definePrototype<ShadcnDatePickerDayProps, DatePickerDayExposes>({
  name: 'shadcn-date-picker-day',
  modules: asDatePickerDay.modules,
  setup(def) {
    const behavior = asDatePickerDay();
    const state = behavior.getAsHookHandle?.('as-calendar-day')?.stateHandles;
    if (!state) throw new Error('[shadcn-date-picker] Day state unavailable.');
    setupCalendarDayVisual(def, state);
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.rangePending).eq(true),
          w.state(state.selected).eq(false),
          w.state(state.rangeMiddle).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent/50 text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.any(w.state(state.rangeStart).eq(true), w.state(state.rangeEnd).eq(true)),
      intent: (i) => i.feedback.style.use(tw('font-medium')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return behavior.render;
  },
});
export { datePickerDay as shadcnDatePickerDay };

export const datePickerValue = definePrototype<ShadcnDatePickerValueProps, DatePickerValueExposes>({
  name: 'shadcn-date-picker-value',
  modules: asDatePickerValue.modules,
  setup(def) {
    const behavior = asDatePickerValue();
    // Text inherits its actual Trigger's typography and empty color, including Mira and Sera.
    def.feedback.style.use(tw('min-w-0 text-start'));
    return behavior.render;
  },
});
export { datePickerValue as shadcnDatePickerValue };
