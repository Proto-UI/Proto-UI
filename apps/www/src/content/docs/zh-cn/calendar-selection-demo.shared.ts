import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

type CalendarFamily = 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

/** Real public atoms own selection, availability, keyboard input and popup completion. */
export function createCalendarSelectionDemo(family: CalendarFamily, picker = false): DemoSpec {
  const proto = (part: string) => `${family}-${part}`;
  const base = family === 'base';
  const navigation = (part: 'previous' | 'next'): DemoNode => ({
    kind: 'proto',
    prototypeId: proto(`calendar-${part}`),
    props: { a11yLabel: part === 'previous' ? 'Previous month' : 'Next month' },
    ...(base ? { className: 'inline-flex size-8 items-center justify-center rounded' } : {}),
    children: [
      {
        kind: 'proto',
        prototypeId: `lucide-chevron-${part === 'previous' ? 'left' : 'right'}-icon`,
        props: { size: 16 },
      },
    ],
  });
  const calendar = (mode: 'range' | 'multiple'): DemoNode[] => [
    {
      kind: 'proto',
      prototypeId: proto('calendar-caption'),
      className: 'flex items-center justify-between',
      children: [
        navigation('previous'),
        { kind: 'proto', prototypeId: proto('calendar-heading') },
        navigation('next'),
      ],
    },
    {
      kind: 'proto',
      prototypeId: proto('calendar-grid'),
      ref: `${mode}-grid`,
      children: [
        {
          kind: 'proto',
          prototypeId: proto('calendar-weekdays'),
          ...(base ? { className: 'grid grid-cols-7' } : {}),
          children: Array.from({ length: 7 }, (_, offset) => ({
            kind: 'proto' as const,
            prototypeId: proto('calendar-weekday'),
            props: { offset },
            ...(base ? { className: 'flex size-8 items-center justify-center text-xs' } : {}),
          })),
        },
        ...Array.from({ length: 6 }, (_, row) => ({
          kind: 'proto' as const,
          prototypeId: proto('calendar-row'),
          props: { index: row },
          ...(base ? { className: 'grid grid-cols-7' } : {}),
          children: Array.from({ length: 7 }, (_, column) => ({
            kind: 'proto' as const,
            prototypeId: proto(picker ? 'date-picker-day' : 'calendar-day'),
            ref: `${mode}-day-${row * 7 + column}`,
            props: { offset: row * 7 + column },
            ...(base
              ? {
                  className:
                    'flex size-8 items-center justify-center rounded text-sm data-[selected]:font-bold data-[range-middle]:rounded-none data-[range-middle]:bg-slate-100 data-[range-start]:bg-slate-900 data-[range-start]:text-white data-[range-end]:bg-slate-900 data-[range-end]:text-white data-[outside]:opacity-50 data-[disabled]:opacity-30',
                }
              : {}),
          })),
        })),
      ],
    },
  ];
  const example = (mode: 'range' | 'multiple'): DemoNode => ({
    kind: 'box',
    className: 'flex flex-col items-start gap-2.5',
    children: [
      {
        kind: 'box',
        className: 'text-sm font-medium text-foreground',
        children: [mode === 'range' ? 'Date range' : 'Multiple dates'],
      },
      {
        kind: 'proto',
        prototypeId: proto(picker ? 'date-picker-root' : 'calendar-root'),
        ref: mode,
        props: {
          mode,
          defaultMonth: '2026-10',
          min: '2026-10-01',
          max: '2026-11-30',
          unavailable: ['2026-10-18'],
          a11yLabel: mode === 'range' ? 'Choose a date range' : 'Choose up to four dates',
          ...(mode === 'range'
            ? {
                defaultRange: { from: '2026-10-10', to: '2026-10-14' },
                minNights: 1,
                maxNights: 14,
              }
            : { defaultValues: ['2026-10-03', '2026-10-08', '2026-10-12'], maxSelected: 4 }),
        },
        ...(base
          ? { className: picker ? 'inline-grid' : 'inline-grid gap-2 rounded-lg border p-3' }
          : family === 'shadcn' && !picker
            ? { className: 'rounded-lg border border-border' }
            : {}),
        children: picker
          ? [
              {
                kind: 'proto',
                prototypeId: proto('date-picker-trigger'),
                ref: `${mode}-trigger`,
                ...(base ? { className: 'inline-flex rounded border px-3 py-2 text-sm' } : {}),
                children: [
                  {
                    kind: 'proto',
                    prototypeId: proto('date-picker-value'),
                    ref: `${mode}-value`,
                    props: { placeholder: 'Choose dates' },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: proto('date-picker-content'),
                ref: `${mode}-content`,
                previewTheme: 'portal',
                props: { side: 'bottom', align: 'start', sideOffset: 6 },
                ...(base
                  ? {
                      className:
                        'z-50 grid gap-2 rounded-lg border bg-white p-3 text-slate-950 shadow-md',
                    }
                  : {}),
                children: calendar(mode),
              },
            ]
          : calendar(mode),
      },
      {
        kind: 'box',
        className: 'max-w-72 text-xs text-muted-foreground',
        children: [
          mode === 'range'
            ? '1–14 nights between Oct 1 and Nov 30. Oct 18 is unavailable.'
            : 'Toggle up to 4 dates. Oct 18 is unavailable.',
        ],
      },
    ],
  });
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className:
        family === 'liquid-glass' && !picker
          ? 'flex max-w-full flex-wrap items-start gap-8 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6'
          : 'flex max-w-full flex-wrap items-start gap-8',
      children: [example('range'), example('multiple')],
    },
  };
}
