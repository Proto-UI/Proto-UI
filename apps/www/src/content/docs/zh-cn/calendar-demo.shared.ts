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
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

export function setupCalendarCaptionDemo({ host, refs, api }: DemoSetupContext) {
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
    // WC replaces its raw record. Retain all owned props and callbacks on every
    // synchronization; React/Vue consume the same complete controlled record.
    let queued = false;
    const publish = () => {
      if (queued) return;
      queued = true;
      // Exposed state may notify during a framework commit. Batch this host
      // owner update after that commit rather than nesting React flushSync.
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

  const onDomProposal = (event: Event) => {
    if (!active || !(event instanceof CustomEvent)) return;
    // Never treat a native change or a nested/sibling control's event as this
    // owner's proposal. WC uses DOM events; React and Vue use callbacks above.
    if (event.target === refs['month-select'] && event.type === 'valueChange') {
      monthControl.onValueChange(event.detail);
    } else if (event.target === refs['year-select'] && event.type === 'valueChange') {
      yearControl.onValueChange(event.detail);
    } else if (event.target === refs.calendar) {
      if (event.type === 'monthChange') onMonthChange(event.detail);
      else onValueChange(event.detail);
    }
  };
  host.addEventListener('monthChange', onDomProposal);
  host.addEventListener('valueChange', onDomProposal);

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
    host.removeEventListener('monthChange', onDomProposal);
    host.removeEventListener('valueChange', onDomProposal);
    binding?.dispose();
  };
}

export function createCalendarDemo(family: CalendarFamily): DemoSpec {
  // A small explicit demo range avoids mounting hundreds of Select Items. The
  // host chooses these options; Calendar itself has no such year restriction.
  const year = new Date().getFullYear();
  const firstYear = Math.max(0, year - 10);
  const lastYear = Math.min(9999, year + 10);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) =>
    String(firstYear + index).padStart(4, '0')
  );
  const proto = (part: string) => `${family}-${part}`;
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
        ...(family === 'shadcn' ? { props: { size: 'sm', appearance: 'ghost' } } : {}),
        className:
          family === 'base'
            ? 'inline-flex items-center justify-between gap-1 rounded px-1 text-sm'
            : 'gap-1 text-sm',
        // This demo's compact caption is an explicit public surface override,
        // not a new size API or a mutation of any family's Select recipe.
        surfaceStyle: {
          height: '28px',
          'min-height': '28px',
          padding: '0 4px',
          width: field === 'month' ? '60px' : '64px',
        },
        children: [
          {
            // Real authored content supplies the existing Select nameFromContent
            // protocol. The demo never writes an Adapter-owned ARIA attribute.
            kind: 'box',
            tag: 'span',
            className: 'sr-only',
            children: [field === 'month' ? 'Month ' : 'Year '],
          },
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
          'overflow-y': 'auto',
        },
        ...(family === 'base'
          ? { className: 'z-50 rounded border bg-white p-1 text-slate-900 shadow-md' }
          : {}),
        children: (field === 'month' ? months : years).map((label, index) => ({
          kind: 'proto' as const,
          prototypeId: proto('select-item'),
          props: {
            value: field === 'month' ? String(index + 1) : label,
            textValue: field === 'month' ? label.slice(0, 3) : label,
          },
          ...(family === 'base'
            ? {
                className:
                  'block cursor-pointer rounded px-2 py-1 text-sm data-[active]:bg-slate-100 data-[selected]:font-semibold',
              }
            : {}),
          children: [label],
        })),
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
  return {
    type: 'demo',
    setup: setupCalendarCaptionDemo,
    root: {
      kind: 'box',
      className: 'inline-flex max-w-full flex-col items-start gap-3',
      children: [
        {
          kind: 'proto',
          prototypeId: proto('calendar-root'),
          ref: 'calendar',
          props: { locale: 'en-US', weekStartsOn: 0, a11yLabel: 'Choose a date' },
          ...(family === 'base'
            ? { className: 'inline-grid gap-2 p-3' }
            : family === 'shadcn'
              ? { className: 'rounded-lg border border-border' }
              : {}),
          children: [
            {
              kind: 'proto',
              prototypeId: proto('calendar-caption'),
              props: { a11yLabel: 'Choose month and year' },
              className: 'flex items-center justify-between',
              children: [
                navigation('previous'),
                select('month'),
                select('year'),
                navigation('next'),
              ],
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
        },
        {
          kind: 'box',
          className: 'max-w-xs text-xs text-muted-foreground',
          children: [
            `月份与年份使用同族 Select，通过 Calendar 公开 API 组合。年份选项：${firstYear}–${lastYear}；今天由本地时钟提供。`,
          ],
        },
      ],
    },
  };
}
