import {
  bindCalendarCaption,
  type CalendarCaptionBinding,
  type CalendarCaptionState,
} from '@proto.ui/prototypes-base/calendar';
import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';

type CalendarFamily = 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
export interface CalendarDemoOptions {
  /** Host caption formatting only; Calendar weekday/date semantics stay en-US. */
  captionLocale?: string | string[];
}

const CAPTION_TRIGGER_METRICS: Record<
  CalendarFamily,
  { height: string; padding: string; monthMinWidth: string; yearMinWidth: string }
> = {
  base: { height: '28px', padding: '0 6px', monthMinWidth: '60px', yearMinWidth: '64px' },
  shadcn: { height: '32px', padding: '0 8px', monthMinWidth: '64px', yearMinWidth: '68px' },
  brutalist: { height: '32px', padding: '0 8px', monthMinWidth: '68px', yearMinWidth: '72px' },
  'bootstrap-2-3-2': {
    height: '30px',
    padding: '0 8px',
    monthMinWidth: '64px',
    yearMinWidth: '68px',
  },
  'liquid-glass': {
    height: '36px',
    padding: '0 10px',
    monthMinWidth: '68px',
    yearMinWidth: '72px',
  },
};

function captionMonthLabels(locale: CalendarDemoOptions['captionLocale']): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, month) =>
    formatter.format(new Date(Date.UTC(2000, month, 1)))
  );
}

function localCivilDate(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function exposedState<Value>(value: unknown, label: string): CalendarCaptionState<Value> {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as CalendarCaptionState<Value>).get !== 'function' ||
    typeof (value as CalendarCaptionState<Value>).subscribe !== 'function'
  )
    throw new Error(`Calendar demo requires the public ${label} get/subscribe handle.`);
  return value as CalendarCaptionState<Value>;
}

export function setupCalendarCaptionDemo({ host, api }: DemoSetupContext) {
  let active = true;
  let binding: CalendarCaptionBinding | undefined;
  let today = localCivilDate(new Date());
  let month = today.slice(0, 7);
  let value = today;
  let midnightTimer: ReturnType<typeof setTimeout>;
  const readDetail = (detail: unknown, key: string) =>
    detail && typeof detail === 'object' ? (detail as Record<string, unknown>)[key] : undefined;
  const rootProps = () => ({
    month,
    value,
    today,
    locale: 'en-US',
    weekStartsOn: 0,
    fixedWeeks: false,
    a11yLabel: 'Choose a date',
    onMonthChange,
    onValueChange,
  });
  function onMonthChange(detail: unknown) {
    const next = readDetail(detail, 'month');
    if (!active || typeof next !== 'string' || next === month) return;
    month = next;
    api.setProps('calendar', rootProps());
  }
  function onValueChange(detail: unknown) {
    const next = readDetail(detail, 'value');
    if (!active || typeof next !== 'string' || next === value) return;
    value = next;
    api.setProps('calendar', rootProps());
  }

  function control(ref: 'month-select' | 'year-select', field: 'month' | 'year') {
    let selected = '';
    let disabled = false;
    const onValueChange = (detail: unknown) => {
      const next = readDetail(detail, 'value');
      if (!active || typeof next !== 'string') return;
      if (field === 'month') binding?.requestMonth(next);
      else binding?.requestYear(next);
    };
    let queued = false;
    const publish = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (active) api.setProps(ref, { value: selected, disabled, onValueChange });
      });
    };
    publish();
    return {
      onValueChange,
      setValue(next: string) {
        if (selected === next) return;
        selected = next;
        publish();
      },
      setDisabled(next: boolean) {
        if (disabled === next) return;
        disabled = next;
        publish();
      },
    };
  }
  const monthControl = control('month-select', 'month');
  const yearControl = control('year-select', 'year');
  api.setProps('calendar', rootProps());
  const exposes = api.getExposes('calendar');
  binding = bindCalendarCaption(
    {
      month: exposedState<string>(exposes?.month, 'month'),
      disabled: exposedState<boolean>(exposes?.disabled, 'disabled'),
      requestMonth: (next) => api.call('calendar', 'requestMonth', next) === true,
    },
    { month: monthControl, year: yearControl }
  );

  const refreshClock = () => {
    if (!active) return;
    clearTimeout(midnightTimer);
    const now = new Date();
    const nextToday = localCivilDate(now);
    if (nextToday !== today) {
      today = nextToday;
      api.setProps('calendar', rootProps());
    }
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(refreshClock, Math.max(1, midnight.getTime() - now.getTime()));
  };
  const document = host.ownerDocument;
  document.addEventListener('visibilitychange', refreshClock);
  refreshClock();
  return () => {
    active = false;
    clearTimeout(midnightTimer);
    document.removeEventListener('visibilitychange', refreshClock);
    binding?.dispose();
  };
}

export function createCalendarDemo(
  family: CalendarFamily,
  options: CalendarDemoOptions = {}
): DemoSpec {
  const months = captionMonthLabels(options.captionLocale);
  const year = new Date().getFullYear();
  const firstYear = Math.max(0, year - (family === 'shadcn' ? 100 : 10));
  const lastYear = Math.min(9999, year + (family === 'shadcn' ? 0 : 10));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) =>
    String(firstYear + index).padStart(4, '0')
  );
  const metrics = CAPTION_TRIGGER_METRICS[family];
  const proto = (part: string) => `${family}-${part}`;
  const selectItems = (field: 'month' | 'year'): DemoNode[] =>
    (field === 'month' ? months : years).map((label, index) => ({
      kind: 'proto',
      prototypeId: proto('select-item'),
      props: {
        value: field === 'month' ? String(index + 1) : label,
        textValue: label,
      },
      ...(family === 'base'
        ? {
            className:
              'block cursor-pointer rounded px-2 py-1 text-sm data-[active]:bg-slate-100 data-[selected]:font-semibold',
          }
        : {}),
      children:
        family === 'shadcn'
          ? [{ kind: 'proto', prototypeId: proto('select-item-text'), children: [label] }]
          : [label],
    }));
  const select = (field: 'month' | 'year'): DemoNode => ({
    kind: 'proto',
    prototypeId: proto('select-root'),
    ref: `${field}-select`,
    props: { value: '', disabled: false },
    className: 'relative inline-flex min-w-0',
    children: [
      {
        kind: 'proto',
        prototypeId: proto('select-trigger'),
        ref: `${field}-trigger`,
        props: {
          accessibleLabel: field === 'month' ? 'Month' : 'Year',
          ...(family === 'shadcn' ? { size: 'sm' } : {}),
        },
        className:
          family === 'base'
            ? 'inline-flex items-center justify-between gap-1 rounded px-1 text-sm'
            : 'gap-1 text-sm',
        surfaceStyle: {
          height: metrics.height,
          'min-height': metrics.height,
          padding: metrics.padding,
          'min-width': field === 'month' ? metrics.monthMinWidth : metrics.yearMinWidth,
          width: 'max-content',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: proto('select-value'),
            props: { placeholder: field === 'month' ? 'Month' : 'Year' },
          },
          ...(family === 'base'
            ? [
                {
                  kind: 'proto' as const,
                  prototypeId: 'lucide-chevron-down-icon',
                  props: { size: 12 },
                },
              ]
            : []),
        ],
      },
      {
        kind: 'proto',
        prototypeId: proto('select-content'),
        props: {
          side: 'bottom',
          align: 'start',
          sideOffset: 4,
          ...(family === 'shadcn' ? { position: 'popper' } : {}),
        },
        surfaceStyle: {
          'max-height': '224px',
          'min-width': field === 'month' ? '112px' : '80px',
          ...(family === 'shadcn' ? {} : { 'overflow-y': 'auto' }),
        },
        ...(family === 'base'
          ? { className: 'z-50 rounded border bg-white p-1 text-slate-900 shadow-md' }
          : {}),
        children:
          family === 'shadcn'
            ? [
                {
                  kind: 'proto',
                  prototypeId: proto('select-surface'),
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: proto('select-viewport'),
                      surfaceStyle: { 'max-height': '224px', 'overflow-y': 'auto' },
                      children: selectItems(field),
                    },
                  ],
                },
              ]
            : selectItems(field),
      },
    ],
  });
  const navigation = (part: 'previous' | 'next'): DemoNode => ({
    kind: 'proto',
    prototypeId: proto(`calendar-${part}`),
    props: { a11yLabel: part === 'previous' ? 'Previous month' : 'Next month' },
    ...(family === 'base'
      ? { className: 'inline-flex size-7 items-center justify-center rounded' }
      : {}),
    children: [
      {
        kind: 'proto',
        prototypeId: `lucide-chevron-${part === 'previous' ? 'left' : 'right'}-icon`,
        props: { size: 16 },
      },
    ],
  });
  const calendarNode: DemoNode = {
    kind: 'proto',
    prototypeId: proto('calendar-root'),
    ref: 'calendar',
    props: {
      locale: 'en-US',
      weekStartsOn: 0,
      fixedWeeks: false,
      a11yLabel: 'Choose a date',
    },
    ...(family === 'base'
      ? { className: 'inline-grid gap-2 rounded-lg border p-3' }
      : family === 'shadcn'
        ? { className: 'rounded-lg border border-border' }
        : {}),
    children: [
      {
        kind: 'proto',
        prototypeId: proto('calendar-caption'),
        props: { a11yLabel: 'Choose month and year' },
        className: 'flex items-center justify-between',
        children: [navigation('previous'), select('month'), select('year'), navigation('next')],
      },
      { kind: 'proto', prototypeId: proto('calendar-heading'), className: 'sr-only' },
      {
        kind: 'proto',
        prototypeId: proto('calendar-grid'),
        children: [
          {
            kind: 'proto',
            prototypeId: proto('calendar-weekdays'),
            ...(family === 'base' ? { className: 'grid grid-cols-7' } : {}),
            children: Array.from({ length: 7 }, (_, offset) => ({
              kind: 'proto' as const,
              prototypeId: proto('calendar-weekday'),
              props: { offset },
              ...(family === 'base'
                ? { className: 'flex size-7 items-center justify-center text-xs' }
                : {}),
            })),
          },
          ...Array.from({ length: 6 }, (_, row) => ({
            kind: 'proto' as const,
            prototypeId: proto('calendar-row'),
            props: { index: row },
            ...(family === 'base' ? { className: 'grid grid-cols-7' } : {}),
            children: Array.from({ length: 7 }, (_, column) => ({
              kind: 'proto' as const,
              prototypeId: proto('calendar-day'),
              props: { offset: row * 7 + column },
              ...(family === 'base'
                ? {
                    className:
                      'flex size-7 items-center justify-center text-sm data-[selected]:font-bold data-[outside]:opacity-50',
                  }
                : {}),
            })),
          })),
        ],
      },
    ],
  };

  return {
    type: 'demo',
    setup: setupCalendarCaptionDemo,
    root: {
      kind: 'box',
      className:
        family === 'liquid-glass'
          ? 'inline-flex max-w-full items-center justify-center'
          : 'inline-flex max-w-full flex-col items-start gap-3',
      children: [calendarNode],
    },
  };
}
