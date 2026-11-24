import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export type DatePickerDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

interface DatePickerInstanceOptions {
  family: DatePickerDemoFamily;
  refPrefix: string;
  label?: string;
  helper?: string;
  placeholder?: string;
  triggerClassName?: string;
  triggerProps?: Record<string, unknown>;
  contentProps?: Record<string, unknown>;
  rootProps?: Record<string, unknown>;
  previousLabel?: string;
  nextLabel?: string;
  chevron?: string;
}

function buildCalendarContent(
  family: DatePickerDemoFamily,
  refPrefix: string,
  previousLabel = 'Previous month',
  nextLabel = 'Next month'
): DemoNode[] {
  const proto = (part: string) => `${family}-${part}`;
  const navButton = (part: 'previous' | 'next'): DemoNode => ({
    kind: 'proto',
    prototypeId: proto(`calendar-${part}`),
    props: { a11yLabel: part === 'previous' ? previousLabel : nextLabel },
    children: [part === 'previous' ? '‹' : '›'],
  });

  return [
    {
      kind: 'proto',
      prototypeId: proto('calendar-caption'),
      children: [
        navButton('previous'),
        { kind: 'proto', prototypeId: proto('calendar-heading') },
        navButton('next'),
      ],
    },
    {
      kind: 'proto',
      prototypeId: proto('calendar-grid'),
      ref: `${refPrefix}-grid`,
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
            prototypeId: proto('date-picker-day'),
            ref: `${refPrefix}-day-${row * 7 + column}`,
            props: { offset: row * 7 + column },
          })),
        })),
      ],
    },
  ];
}

function buildPickerNode(options: DatePickerInstanceOptions): DemoNode {
  const {
    family,
    refPrefix,
    label,
    helper,
    placeholder = 'Pick a date',
    triggerClassName = 'w-56',
    triggerProps,
    contentProps,
    rootProps,
    previousLabel,
    nextLabel,
    chevron = '▾',
  } = options;
  const proto = (part: string) => `${family}-${part}`;

  const rootNode: DemoNode = {
    kind: 'proto',
    prototypeId: proto('date-picker-root'),
    ref: refPrefix,
    props: {
      defaultMonth: '2026-10',
      ...rootProps,
    },
    children: [
      {
        kind: 'proto',
        prototypeId: proto('date-picker-trigger'),
        ref: `${refPrefix}-trigger`,
        className: triggerClassName,
        ...(triggerProps ? { props: triggerProps } : {}),
        children: [
          {
            kind: 'proto',
            prototypeId: proto('date-picker-value'),
            ref: `${refPrefix}-value`,
            props: { placeholder },
          },
          {
            kind: 'box',
            tag: 'span',
            attrs: { 'aria-hidden': 'true' },
            className: 'ms-2 shrink-0 text-xs',
            children: [chevron],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: proto('date-picker-content'),
        ref: `${refPrefix}-content`,
        previewTheme: 'portal',
        props: {
          side: 'bottom',
          align: 'start',
          sideOffset: 6,
          ...contentProps,
        },
        children: buildCalendarContent(family, refPrefix, previousLabel, nextLabel),
      },
    ],
  };

  if (!label && !helper) {
    return rootNode;
  }

  return {
    kind: 'box',
    className: 'flex flex-col items-start gap-2',
    children: [
      ...(label
        ? [
            {
              kind: 'box' as const,
              tag: 'span' as const,
              className: 'text-sm font-medium text-foreground',
              children: [label],
            },
          ]
        : []),
      rootNode,
      ...(helper
        ? [
            {
              kind: 'box' as const,
              className: 'max-w-64 text-xs text-muted-foreground',
              children: [helper],
            },
          ]
        : []),
    ],
  };
}

function wrapFamilyStage(family: DatePickerDemoFamily, child: DemoNode): DemoSpec {
  if (family === 'liquid-glass') {
    return {
      type: 'demo',
      root: {
        kind: 'box',
        className:
          'flex w-full justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
        children: [child],
      },
    };
  }
  return {
    type: 'demo',
    root: child,
  };
}

/** Primary hero date picker: opens empty with placeholder and complete navigable calendar. */
export function createDatePickerHeroDemo(family: DatePickerDemoFamily): DemoSpec {
  return wrapFamilyStage(
    family,
    buildPickerNode({
      family,
      refPrefix: 'hero',
      placeholder: 'Pick a date',
      triggerClassName: 'w-56',
      rootProps: {
        defaultMonth: '2026-10',
        today: '2026-10-15',
        a11yLabel: 'Pick a date',
      },
    })
  );
}

/** Basic labeled date picker with bounded dates. */
export function createDatePickerBasicDemo(family: DatePickerDemoFamily): DemoSpec {
  return wrapFamilyStage(
    family,
    buildPickerNode({
      family,
      refPrefix: 'basic',
      label: 'Date',
      helper: 'Select a date in October or November 2026.',
      placeholder: 'Pick a date',
      triggerClassName: 'w-56',
      rootProps: {
        defaultMonth: '2026-10',
        defaultValue: '2026-10-15',
        min: '2026-10-01',
        max: '2026-11-30',
        today: '2026-10-15',
        a11yLabel: 'Date',
      },
    })
  );
}

/** Dedicated range picker example with night constraints and unavailable date. */
export function createDatePickerRangeDemo(family: DatePickerDemoFamily): DemoSpec {
  return wrapFamilyStage(
    family,
    buildPickerNode({
      family,
      refPrefix: 'range',
      label: 'Date Picker Range',
      helper: 'Choose 1–14 nights. October 18 is unavailable.',
      placeholder: 'Pick a date range',
      triggerClassName: 'w-64',
      rootProps: {
        mode: 'range',
        defaultMonth: '2026-10',
        defaultRange: { from: '2026-10-10', to: '2026-10-16' },
        min: '2026-10-01',
        max: '2026-11-30',
        unavailable: ['2026-10-18'],
        minNights: 1,
        maxNights: 14,
        today: '2026-10-15',
        a11yLabel: 'Choose a date range',
      },
    })
  );
}

/** Multiple selection paired with disabled state (and Liquid Glass prominence/opaque options). */
export function createDatePickerMultipleDemo(family: DatePickerDemoFamily): DemoSpec {
  const items: DemoNode[] = [
    buildPickerNode({
      family,
      refPrefix: 'multiple',
      label: 'Multiple Dates',
      helper: 'Toggle up to 4 dates; popup stays open for consecutive picks.',
      placeholder: 'Pick dates',
      triggerClassName: 'w-64',
      ...(family === 'liquid-glass' ? { triggerProps: { variant: 'prominent' } } : {}),
      rootProps: {
        mode: 'multiple',
        defaultMonth: '2026-10',
        defaultValues: ['2026-10-05', '2026-10-12'],
        maxSelected: 4,
        min: '2026-10-01',
        max: '2026-10-31',
        unavailable: ['2026-10-18', '2026-10-19'],
        today: '2026-10-15',
        a11yLabel: 'Choose up to four dates',
      },
    }),
    buildPickerNode({
      family,
      refPrefix: 'disabled',
      label: 'Disabled',
      helper: 'Interaction and popup open are disabled.',
      placeholder: 'Unavailable',
      triggerClassName: 'w-56',
      ...(family === 'liquid-glass' ? { contentProps: { material: 'opaque' } } : {}),
      rootProps: {
        defaultMonth: '2026-10',
        defaultValue: '2026-10-20',
        disabled: true,
        a11yLabel: 'Disabled date picker',
      },
    }),
  ];

  return wrapFamilyStage(family, {
    kind: 'box',
    className: 'flex max-w-full flex-wrap items-start gap-8',
    children: items,
  });
}

/** Range + Multiple side-by-side comparison (replaces legacy bilingual mashup selection demo). */
export function createDatePickerSelectionDemo(family: DatePickerDemoFamily): DemoSpec {
  return wrapFamilyStage(family, {
    kind: 'box',
    className: 'flex max-w-full flex-wrap items-start gap-8',
    children: [
      buildPickerNode({
        family,
        refPrefix: 'range',
        label: 'Date Range',
        helper: 'Select start and end dates (1–14 nights; Oct 18 unavailable).',
        placeholder: 'Pick a date range',
        triggerClassName: 'w-64',
        rootProps: {
          mode: 'range',
          defaultMonth: '2026-10',
          defaultRange: { from: '2026-10-10', to: '2026-10-14' },
          min: '2026-10-01',
          max: '2026-11-30',
          unavailable: ['2026-10-18'],
          minNights: 1,
          maxNights: 14,
          today: '2026-10-15',
          a11yLabel: 'Choose a date range',
        },
      }),
      buildPickerNode({
        family,
        refPrefix: 'multiple',
        label: 'Multiple Dates',
        helper: 'Toggle up to four dates (Oct 18 unavailable).',
        placeholder: 'Pick dates',
        triggerClassName: 'w-64',
        rootProps: {
          mode: 'multiple',
          defaultMonth: '2026-10',
          defaultValues: ['2026-10-03', '2026-10-08', '2026-10-12'],
          maxSelected: 4,
          min: '2026-10-01',
          max: '2026-11-30',
          unavailable: ['2026-10-18'],
          today: '2026-10-15',
          a11yLabel: 'Choose up to four dates',
        },
      }),
    ],
  });
}

/** RTL direction and Arabic locale date picker. */
export function createDatePickerRtlDemo(family: DatePickerDemoFamily): DemoSpec {
  return wrapFamilyStage(
    family,
    buildPickerNode({
      family,
      refPrefix: 'rtl',
      label: 'تاريخ الموعد (RTL · ar-SA)',
      placeholder: 'اختر تاريخًا',
      triggerClassName: 'w-56',
      previousLabel: 'الشهر السابق',
      nextLabel: 'الشهر التالي',
      rootProps: {
        defaultMonth: '2026-10',
        locale: 'ar-SA',
        direction: 'rtl',
        today: '2026-10-15',
        a11yLabel: 'اختر تاريخًا',
      },
    })
  );
}
