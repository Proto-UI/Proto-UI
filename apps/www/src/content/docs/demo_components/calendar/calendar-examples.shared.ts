import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

export type CalendarExampleFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

const LIQUID_GLASS_BACKDROP = 'inline-flex max-w-full items-center justify-center';

function wrapSurface(family: CalendarExampleFamily, node: DemoNode): DemoNode {
  if (family !== 'liquid-glass') return node;
  return {
    kind: 'box',
    className: LIQUID_GLASS_BACKDROP,
    children: [node],
  };
}

function buildCalendarTree(
  family: CalendarExampleFamily,
  props: Record<string, unknown>,
  options: { ref?: string; extraClassName?: string } = {}
): DemoNode {
  const proto = (part: string) => `${family}-${part}`;
  const isRtl = props.direction === 'rtl';
  const nav = (part: 'previous' | 'next'): DemoNode => {
    const iconDirection =
      part === 'previous' ? (isRtl ? 'right' : 'left') : isRtl ? 'left' : 'right';
    return {
      kind: 'proto',
      prototypeId: proto(`calendar-${part}`),
      props: {
        a11yLabel: part === 'previous' ? 'Previous month' : 'Next month',
      },
      children: [
        {
          kind: 'proto',
          prototypeId: `lucide-chevron-${iconDirection}-icon`,
          props: { size: 16 },
        },
      ],
    };
  };

  const baseClassName = family === 'shadcn' ? 'rounded-lg border border-border' : undefined;
  const className = [baseClassName, options.extraClassName].filter(Boolean).join(' ') || undefined;

  return {
    kind: 'proto',
    prototypeId: proto('calendar-root'),
    ...(options.ref ? { ref: options.ref } : {}),
    props,
    ...(className ? { className } : {}),
    children: [
      {
        kind: 'proto',
        prototypeId: proto('calendar-caption'),
        children: [
          nav('previous'),
          { kind: 'proto', prototypeId: proto('calendar-heading') },
          nav('next'),
        ],
      },
      {
        kind: 'proto',
        prototypeId: proto('calendar-grid'),
        children: [
          {
            kind: 'proto',
            prototypeId: proto('calendar-weekdays'),
            children: Array.from({ length: 7 }, (_, offset) => ({
              kind: 'proto' as const,
              prototypeId: proto('calendar-weekday'),
              props: { offset },
            })),
          },
          ...Array.from({ length: 6 }, (_, row) => ({
            kind: 'proto' as const,
            prototypeId: proto('calendar-row'),
            props: { index: row },
            children: Array.from({ length: 7 }, (_, column) => ({
              kind: 'proto' as const,
              prototypeId: proto('calendar-day'),
              props: { offset: row * 7 + column },
            })),
          })),
        ],
      },
    ],
  };
}

export function createCalendarBasicDemo(family: CalendarExampleFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapSurface(
      family,
      buildCalendarTree(family, {
        mode: 'single',
        defaultMonth: '2026-10',
        defaultValue: '2026-10-12',
        today: '2026-10-08',
        locale: 'en-US',
        weekStartsOn: 0,
        a11yLabel: 'Calendar',
      })
    ),
  };
}

export function createCalendarRangeDemo(family: CalendarExampleFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapSurface(
      family,
      buildCalendarTree(family, {
        mode: 'range',
        defaultMonth: '2026-10',
        defaultRange: { from: '2026-10-08', to: '2026-10-16' },
        today: '2026-10-04',
        locale: 'en-US',
        weekStartsOn: 0,
        a11yLabel: 'Select date range',
      })
    ),
  };
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${String(next.getUTCFullYear()).padStart(4, '0')}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

const PRESETS = [
  { id: 'preset-0', label: 'Today', days: 0 },
  { id: 'preset-1', label: 'Tomorrow', days: 1 },
  { id: 'preset-3', label: 'In 3 days', days: 3 },
  { id: 'preset-7', label: 'In a week', days: 7 },
  { id: 'preset-14', label: 'In 2 weeks', days: 14 },
] as const;

function setupPresetsDemo({ refs, api }: DemoSetupContext) {
  let active = true;
  const baseDate = '2026-10-10';
  let value = '2026-10-12';
  let month = '2026-10';

  const readDetail = (detail: unknown, key: string) =>
    detail && typeof detail === 'object' ? (detail as Record<string, unknown>)[key] : undefined;

  const rootProps = () => ({
    mode: 'single',
    month,
    value,
    today: baseDate,
    fixedWeeks: true,
    locale: 'en-US',
    weekStartsOn: 0,
    a11yLabel: 'Choose a date with presets',
    onMonthChange,
    onValueChange,
  });

  function onMonthChange(detail: unknown) {
    const next = readDetail(detail, 'month');
    if (!active || typeof next !== 'string' || next === month) return;
    month = next;
    api.setProps('presets-calendar', rootProps());
  }

  function onValueChange(detail: unknown) {
    const next = readDetail(detail, 'value');
    if (!active || typeof next !== 'string' || next === value) return;
    value = next;
    api.setProps('presets-calendar', rootProps());
  }

  api.setProps('presets-calendar', rootProps());

  const cleanups: Array<() => void> = [];
  for (const preset of PRESETS) {
    const buttonEl = refs[preset.id];
    if (!buttonEl) continue;
    const handler = () => {
      if (!active) return;
      const target = addDaysIso(baseDate, preset.days);
      value = target;
      month = target.slice(0, 7);
      api.setProps('presets-calendar', rootProps());
    };
    buttonEl.addEventListener('click', handler);
    cleanups.push(() => buttonEl.removeEventListener('click', handler));
  }

  return () => {
    active = false;
    for (const dispose of cleanups) dispose();
  };
}

export function createCalendarPresetsDemo(family: CalendarExampleFamily): DemoSpec {
  const buttonProps =
    family === 'shadcn'
      ? { variant: 'outline', size: 'sm' }
      : family === 'liquid-glass'
        ? { variant: 'regular' }
        : {};

  const presetButtons: DemoNode[] = PRESETS.map((preset) => ({
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref: preset.id,
    props: buttonProps,
    className: 'flex-1',
    children: [preset.label],
  }));

  const container: DemoNode = {
    kind: 'box',
    className: 'inline-flex w-fit max-w-full flex-col items-center gap-3',
    children: [
      buildCalendarTree(
        family,
        {
          mode: 'single',
          defaultMonth: '2026-10',
          defaultValue: '2026-10-12',
          today: '2026-10-10',
          fixedWeeks: true,
          locale: 'en-US',
          weekStartsOn: 0,
          a11yLabel: 'Choose a date with presets',
        },
        { ref: 'presets-calendar' }
      ),
      {
        kind: 'box',
        className: 'flex max-w-[300px] flex-wrap gap-2',
        children: presetButtons,
      },
    ],
  };

  return {
    type: 'demo',
    setup: setupPresetsDemo,
    root: wrapSurface(family, container),
  };
}

export function createCalendarBookedDatesDemo(family: CalendarExampleFamily): DemoSpec {
  const booked = Array.from({ length: 9 }, (_, i) => `2026-10-${String(12 + i).padStart(2, '0')}`);
  return {
    type: 'demo',
    root: wrapSurface(
      family,
      buildCalendarTree(family, {
        mode: 'single',
        defaultMonth: '2026-10',
        defaultValue: '2026-10-06',
        today: '2026-10-06',
        min: '2026-10-01',
        max: '2026-10-31',
        unavailable: booked,
        locale: 'en-US',
        weekStartsOn: 0,
        a11yLabel: 'Select an available date',
      })
    ),
  };
}

export function createCalendarRtlDemo(family: CalendarExampleFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapSurface(
      family,
      buildCalendarTree(family, {
        mode: 'single',
        defaultMonth: '2026-10',
        defaultValue: '2026-10-12',
        today: '2026-10-08',
        locale: 'ar-SA',
        direction: 'rtl',
        weekStartsOn: 6,
        a11yLabel: 'اختر تاريخاً',
      })
    ),
  };
}
