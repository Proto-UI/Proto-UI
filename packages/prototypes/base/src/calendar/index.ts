import {
  createAnatomyFamily,
  createContextKey,
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import {
  asAccessible,
  asCollection,
  asCollectionItem,
  asFocusable,
  asTrigger,
} from '@proto.ui/hooks';
import { asButton } from '../button';
import { callOwner, readPartState } from '../collection-controls/shared';
import { addDays, addMonths, dateAvailable, monthDays, parseDate } from './model';
import type {
  CalendarRootProps,
  CalendarRootExposes,
  CalendarDayProps,
  CalendarDayExposes,
  CalendarDayContract,
  CalendarRootAsHookContract,
  CalendarGridProps,
  CalendarGridExposes,
  CalendarRowProps,
  CalendarRowExposes,
  CalendarHeadingProps,
  CalendarHeadingExposes,
  CalendarHeadingAsHookContract,
  CalendarPreviousProps,
  CalendarPreviousExposes,
  CalendarNavigationAsHookContract,
} from './types';
export * from './model';
export type * from './types';
export const CALENDAR_FAMILY = createAnatomyFamily('base-calendar', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    grid: { cardinality: { min: 0, max: 1 } },
    row: { cardinality: { min: 0, max: '*' } },
    day: { cardinality: { min: 0, max: '*' } },
    heading: { cardinality: { min: 0, max: 1 } },
    previous: { cardinality: { min: 0, max: 1 } },
    next: { cardinality: { min: 0, max: 1 } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'grid' },
    { kind: 'contains', parent: 'grid', child: 'row' },
    { kind: 'contains', parent: 'row', child: 'day' },
  ],
});
type CalendarContext = {
  value: string;
  month: string;
  min: string;
  max: string;
  unavailable: string[];
  disabled: boolean;
  readOnly: boolean;
  weekStartsOn: number;
  active: string;
  focusRequest: { id: number; date: string } | null;
};
export const CALENDAR_CONTEXT = createContextKey<CalendarContext>('base-calendar');
const initial: CalendarContext = {
  value: '',
  month: '1970-01',
  min: '',
  max: '',
  unavailable: [],
  disabled: false,
  readOnly: false,
  weekStartsOn: 0,
  active: '',
  focusRequest: null,
};
function setupRoot(def: DefHandle<CalendarRootProps, CalendarRootExposes>) {
  def.anatomy.claim(CALENDAR_FAMILY, { role: 'root' });
  asCollection().configure({ family: CALENDAR_FAMILY, itemRole: 'day' });
  def.props.define({
    value: { type: 'string' },
    defaultValue: { type: 'string' },
    month: { type: 'string' },
    defaultMonth: { type: 'string' },
    min: { type: 'string' },
    max: { type: 'string' },
    unavailable: {
      type: 'object',
      validator: (value) => Array.isArray(value) && value.every((date) => typeof date === 'string'),
    },
    disabled: { type: 'boolean' },
    readOnly: { type: 'boolean' },
    weekStartsOn: { type: 'number' },
    a11yLabel: { type: 'string' },
  });
  def.props.setDefaults({
    defaultValue: '',
    min: '',
    max: '',
    unavailable: [],
    disabled: false,
    readOnly: false,
    weekStartsOn: 0,
    a11yLabel: 'Calendar',
  });
  const value = def.state.string('value', ''),
    month = def.state.string('month', '1970-01'),
    label = def.state.string('a11yLabel', 'Calendar');
  const a11y = asAccessible();
  a11y.role('group');
  a11y.name(label);
  def.context.provide(CALENDAR_CONTEXT, initial);
  def.context.subscribe(CALENDAR_CONTEXT);
  def.expose.state('value', value);
  def.expose.state('month', month);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('monthChange', { payload: 'json' });
  let owner: RunHandle<CalendarRootProps> | null = null;
  let pendingNavigation: { month: string; date: string; fromMonth: string } | null = null;
  let focusRequestId = 0;
  const publish = (run: RunHandle<CalendarRootProps>, active?: string) => {
    const p = run.props.get(),
      old = run.context.read(CALENDAR_CONTEXT);
    const next: CalendarContext = {
      value: value.get(),
      month: month.get(),
      min: p.min ?? '',
      max: p.max ?? '',
      unavailable: [...(p.unavailable ?? [])],
      disabled: !!p.disabled,
      readOnly: !!p.readOnly,
      weekStartsOn: Number.isFinite(p.weekStartsOn)
        ? ((Math.trunc(p.weekStartsOn!) % 7) + 7) % 7
        : 0,
      active: active ?? old.active,
      focusRequest: null,
    };
    const navigation = pendingNavigation;
    const acceptedNavigation = navigation?.month === next.month && !next.disabled;
    if (acceptedNavigation) next.active = navigation!.date;
    if (navigation && (acceptedNavigation || next.disabled || next.month !== navigation.fromMonth))
      pendingNavigation = null;
    if (
      !next.active ||
      next.active.slice(0, 7) !== next.month ||
      !dateAvailable(next.active, next.min, next.max, next.unavailable)
    )
      next.active =
        next.value.slice(0, 7) === next.month &&
        dateAvailable(next.value, next.min, next.max, next.unavailable)
          ? next.value
          : (monthDays(next.month, next.weekStartsOn).find(
              (date) =>
                date.slice(0, 7) === next.month &&
                dateAvailable(date, next.min, next.max, next.unavailable)
            ) ?? '');
    if (
      acceptedNavigation &&
      next.active &&
      run.anatomy
        .partsOf(CALENDAR_FAMILY, 'day')
        .some((part) => readPartState(part, 'focused') === true)
    )
      next.focusRequest = { id: ++focusRequestId, date: next.active };
    if (JSON.stringify(old) !== JSON.stringify(next)) run.context.update(CALENDAR_CONTEXT, next);
  };
  const requestMonth = (next: string, navigationDate?: string) => {
    if (!owner || owner.props.get().disabled || !parseDate(`${next}-01`)) return false;
    const c = owner.context.read(CALENDAR_CONTEXT);
    const validNavigation =
      navigationDate &&
      navigationDate.slice(0, 7) === next &&
      dateAvailable(navigationDate, c.min, c.max, c.unavailable);
    pendingNavigation = validNavigation
      ? { month: next, date: navigationDate, fromMonth: month.get() }
      : null;
    if (next === month.get()) {
      if (validNavigation) publish(owner);
      return !!validNavigation;
    }
    if (!owner.props.isProvided('month')) month.set(next, 'calendar month request');
    publish(owner);
    owner.expose.emit('monthChange', { month: next });
    return true;
  };
  def.expose.method('requestMonth', requestMonth);
  def.expose.method('requestValue', (next: string) => {
    if (!owner) return false;
    const c = owner.context.read(CALENDAR_CONTEXT);
    if (
      c.disabled ||
      c.readOnly ||
      !dateAvailable(next, c.min, c.max, c.unavailable) ||
      next === value.get()
    )
      return false;
    pendingNavigation = null;
    if (!owner.props.isProvided('value')) value.set(next, 'calendar date request');
    publish(owner, next);
    requestMonth(next.slice(0, 7));
    owner.expose.emit('valueChange', { value: next });
    return true;
  });
  const sync = (run: RunHandle<CalendarRootProps>, created = false) => {
    owner = run;
    const p = run.props.get();
    if (created || run.props.isProvided('value'))
      value.set(
        (run.props.isProvided('value') ? p.value : p.defaultValue) ?? '',
        'calendar owner value'
      );
    if (created || run.props.isProvided('month')) {
      const candidate =
        (run.props.isProvided('month') ? p.month : p.defaultMonth) ?? value.get().slice(0, 7);
      month.set(parseDate(`${candidate}-01`) ? candidate : '1970-01', 'calendar owner month');
    }
    label.set(p.a11yLabel ?? 'Calendar', 'calendar accessible name');
    publish(run);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => sync(run));
  def.props.watchAll((run) => sync(run));
  def.lifecycle.onUnmounted(() => {
    pendingNavigation = null;
    owner = null;
  });
}
export const asCalendarRoot = defineAsHook<
  CalendarRootProps,
  CalendarRootExposes,
  CalendarRootAsHookContract
>({
  name: 'as-calendar-root',
  setup: setupRoot,
});
export const calendarRoot = definePrototype({ name: 'base-calendar-root', setup: setupRoot });
function setupDay(def: DefHandle<CalendarDayProps, CalendarDayExposes>) {
  asCollectionItem().configure({
    family: CALENDAR_FAMILY,
    role: 'day',
    getMeta: () => ({ value: date.get(), disabled: disabled.get() }),
  });
  def.props.define({
    date: { type: 'string' },
    offset: { type: 'number' },
    disabled: { type: 'boolean' },
  });
  def.props.setDefaults({ date: '', offset: 0, disabled: false });
  const date = def.state.string('date', ''),
    selected = def.state.bool('selected', false),
    disabled = def.state.bool('disabled', false),
    outside = def.state.bool('outside', false);
  const focus = asFocusable<CalendarDayProps>();
  focus.configure({ disabled: false, navParticipation: 'none' });
  asTrigger();
  const a11y = asAccessible();
  a11y.role('gridcell');
  a11y.name(date);
  a11y.state('selected', selected);
  a11y.state('disabled', disabled);
  for (const [name, state] of Object.entries({
    date,
    selected,
    disabled,
    outside,
    focused: focus.focused,
    focusVisible: focus.focusVisible,
  }))
    def.expose.state(name as keyof CalendarDayExposes, state);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focus.focusSelf(options);
  });
  let mounted = false;
  let handledFocusRequest = 0;
  const sync = (run: RunHandle<CalendarDayProps>) => {
    const c = run.context.read(CALENDAR_CONTEXT),
      p = run.props.get();
    const next = p.date || monthDays(c.month, c.weekStartsOn)[Math.trunc(p.offset ?? 0)] || '';
    const changed = next !== date.get();
    date.set(next, 'calendar day date');
    selected.set(next === c.value, 'calendar selected date');
    outside.set(next.slice(0, 7) !== c.month, 'calendar outside month');
    disabled.set(
      c.disabled || !!p.disabled || !dateAvailable(next, c.min, c.max, c.unavailable),
      'calendar unavailable date'
    );
    focus.setDisabled(disabled.get());
    focus.setNavParticipation(!disabled.get() && next === c.active ? 'auto' : 'none');
    if (mounted && changed) run.update();
    if (
      mounted &&
      !disabled.get() &&
      c.active === next &&
      c.focusRequest?.date === next &&
      c.focusRequest.id !== handledFocusRequest
    ) {
      handledFocusRequest = c.focusRequest.id;
      focus.focusSelf({ reason: 'keyboard' });
    }
  };
  def.context.subscribe(CALENDAR_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    sync(run);
    run.update();
  });
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(() => {
    mounted = false;
  });
  def.event.on('press.commit', (run) => {
    if (!disabled.get()) callOwner(run, CALENDAR_FAMILY, 'requestValue', date.get());
  });
  def.event.on('key.down', (run, event) => {
    if (!focus.focused.get() || disabled.get() || event.ctrlKey || event.metaKey || event.altKey)
      return;
    const c = run.context.read(CALENDAR_CONTEXT);
    const current = parseDate(date.get());
    if (!current) return;
    let target = '';
    if (event.key === 'ArrowLeft') target = addDays(date.get(), -1);
    if (event.key === 'ArrowRight') target = addDays(date.get(), 1);
    if (event.key === 'ArrowUp') target = addDays(date.get(), -7);
    if (event.key === 'ArrowDown') target = addDays(date.get(), 7);
    if (event.key === 'Home')
      target = addDays(date.get(), -(current.getUTCDay() - c.weekStartsOn + 7) % 7);
    if (event.key === 'End')
      target = addDays(date.get(), 6 - ((current.getUTCDay() - c.weekStartsOn + 7) % 7));
    if (event.key === 'PageUp') target = addMonths(date.get(), event.shiftKey ? -12 : -1);
    if (event.key === 'PageDown') target = addMonths(date.get(), event.shiftKey ? 12 : 1);
    if (!target) return;
    const direction = target < date.get() ? -1 : 1;
    const stride = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 7 : 1;
    for (
      let attempts = 0;
      !dateAvailable(target, c.min, c.max, c.unavailable) && attempts < 366;
      attempts++
    ) {
      if ((c.min && target < c.min && direction < 0) || (c.max && target > c.max && direction > 0))
        return;
      target = addDays(target, direction * stride);
    }
    if (!dateAvailable(target, c.min, c.max, c.unavailable)) return;
    event.control.requestDefaultActionPrevention({
      reason: 'calendar.date-navigation',
      source: 'base-calendar-day',
    });
    callOwner(run, CALENDAR_FAMILY, 'requestMonth', target.slice(0, 7), target);
  });
  return () => (date.get() ? [String(Number(date.get().slice(-2)))] : null);
}
export const asCalendarDay = defineAsHook<
  CalendarDayProps,
  CalendarDayExposes,
  CalendarDayContract
>({ name: 'as-calendar-day', setup: setupDay });
export const calendarDay = definePrototype({ name: 'base-calendar-day', setup: setupDay });
function setupGrid(def: DefHandle<CalendarGridProps, CalendarGridExposes>) {
  def.anatomy.claim(CALENDAR_FAMILY, { role: 'grid' });
  asAccessible().role('grid');
}
function setupRow(def: DefHandle<CalendarRowProps, CalendarRowExposes>) {
  def.anatomy.claim(CALENDAR_FAMILY, { role: 'row' });
  asAccessible().role('row');
}
function setupHeading(def: DefHandle<CalendarHeadingProps, CalendarHeadingExposes>) {
  def.anatomy.claim(CALENDAR_FAMILY, { role: 'heading' });
  const value = def.state.string('month', '');
  def.expose.state('month', value);
  let mounted = false;
  const sync = (run: RunHandle<any>) => {
    const next = run.context.read(CALENDAR_CONTEXT).month;
    if (next === value.get()) return;
    value.set(next, 'calendar heading');
    if (mounted) run.update();
  };
  def.context.subscribe(CALENDAR_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    sync(run);
    run.update();
  });
  def.lifecycle.onUnmounted(() => {
    mounted = false;
  });
  return () => [value.get()];
}
export const asCalendarGrid = defineAsHook({ name: 'as-calendar-grid', setup: setupGrid });
export const asCalendarRow = defineAsHook({ name: 'as-calendar-row', setup: setupRow });
export const asCalendarHeading = defineAsHook<
  CalendarHeadingProps,
  CalendarHeadingExposes,
  CalendarHeadingAsHookContract
>({ name: 'as-calendar-heading', setup: setupHeading });
export const calendarGrid = definePrototype({ name: 'base-calendar-grid', setup: setupGrid });
export const calendarRow = definePrototype({ name: 'base-calendar-row', setup: setupRow });
export const calendarHeading = definePrototype({
  name: 'base-calendar-heading',
  setup: setupHeading,
});
function navigationSetup(direction: -1 | 1) {
  return (def: DefHandle<CalendarPreviousProps, CalendarPreviousExposes>) => {
    const button = asButton();
    const focus = asFocusable();
    def.anatomy.claim(CALENDAR_FAMILY, { role: direction < 0 ? 'previous' : 'next' });
    const sync = (run: RunHandle<any>) => {
      const disabled = run.context.read(CALENDAR_CONTEXT).disabled || !!run.props.get().disabled;
      button.stateHandles?.disabled.set(disabled, 'calendar navigation disabled');
      focus.setDisabled(disabled);
      if (disabled) {
        button.stateHandles?.hovered.set(false, 'calendar disabled reset');
        button.stateHandles?.pressed.set(false, 'calendar disabled reset');
      }
    };
    def.context.subscribe(CALENDAR_CONTEXT, sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    def.props.watchAll(sync);
    def.event.on('press.commit', (run) => {
      if (button.stateHandles?.disabled.get()) return;
      const c = run.context.read(CALENDAR_CONTEXT);
      callOwner(
        run,
        CALENDAR_FAMILY,
        'requestMonth',
        addMonths(`${c.month}-01`, direction).slice(0, 7)
      );
    });
  };
}
export const asCalendarPrevious = defineAsHook<
  CalendarPreviousProps,
  CalendarPreviousExposes,
  CalendarNavigationAsHookContract
>({
  name: 'as-calendar-previous',
  setup: navigationSetup(-1),
});
export const asCalendarNext = defineAsHook<
  CalendarPreviousProps,
  CalendarPreviousExposes,
  CalendarNavigationAsHookContract
>({ name: 'as-calendar-next', setup: navigationSetup(1) });
export const calendarPrevious = definePrototype({
  name: 'base-calendar-previous',
  setup: navigationSetup(-1),
});
export const calendarNext = definePrototype({
  name: 'base-calendar-next',
  setup: navigationSetup(1),
});
