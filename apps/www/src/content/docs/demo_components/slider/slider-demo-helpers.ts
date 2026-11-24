import type {
  DemoChild,
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

export type SliderDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

const LIQUID_GLASS_BACKDROP =
  'w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6';

function wrapSurface(family: SliderDemoFamily, child: DemoNode): DemoNode {
  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className: LIQUID_GLASS_BACKDROP,
      children: [child],
    };
  }
  return {
    kind: 'box',
    className: 'w-full p-4',
    children: [child],
  };
}

function scalarPart(
  family: SliderDemoFamily,
  role: 'root' | 'label' | 'track' | 'indicator' | 'thumb' | 'field-thumb' | 'value',
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  ref?: string
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-slider-${role}`,
    ...(ref ? { ref } : {}),
    props,
    children,
  };
}

function valuesPart(
  family: SliderDemoFamily,
  role: 'root' | 'label' | 'track' | 'indicator' | 'thumb' | 'value',
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  ref?: string
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-slider-values-${role}`,
    ...(ref ? { ref } : {}),
    props,
    children,
  };
}

const formatDecimalValues = (value: unknown): string =>
  Array.isArray(value)
    ? value.map((v) => (typeof v === 'number' ? Number(v.toFixed(2)) : v)).join(', ')
    : value == null
      ? ''
      : String(value);

export function createSliderBasicDemo(family: SliderDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto grid w-full max-w-xs gap-3',
      children: [
        scalarPart(
          family,
          'root',
          { defaultValue: 75, min: 0, max: 100, step: 1, ariaLabel: 'Volume' },
          [
            {
              kind: 'box',
              className: 'flex w-full items-center justify-between text-sm',
              children: [
                scalarPart(family, 'label', {}, ['Volume']),
                scalarPart(family, 'value', {}, []),
              ],
            },
            scalarPart(family, 'track', {}, [
              scalarPart(family, 'indicator'),
              scalarPart(family, 'thumb'),
            ]),
          ]
        ),
      ],
    }),
  };
}

export function createSliderRangeDemo(family: SliderDemoFamily): DemoSpec {
  return {
    type: 'demo',
    setup({ api }: DemoSetupContext) {
      api.setProps('reset', {
        onClick: () => {
          api.call('range', 'resetValue');
        },
      });
    },
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto grid w-full max-w-xs gap-4',
      children: [
        valuesPart(
          family,
          'root',
          {
            defaultValue: [25, 50],
            min: 0,
            max: 100,
            step: 5,
            minStepsBetweenValues: 1,
            ariaLabel: 'Price range',
          },
          [
            {
              kind: 'box',
              className: 'flex w-full items-center justify-between text-sm',
              children: [
                valuesPart(family, 'label', {}, ['Price range']),
                valuesPart(family, 'value', {}, []),
              ],
            },
            valuesPart(family, 'track', {}, [
              valuesPart(family, 'indicator'),
              valuesPart(family, 'thumb', { index: 0, ariaLabel: 'Minimum price' }),
              valuesPart(family, 'thumb', { index: 1, ariaLabel: 'Maximum price' }),
            ]),
          ],
          'range'
        ),
        {
          kind: 'box',
          className: 'flex justify-end',
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-button`,
              ref: 'reset',
              props: family === 'shadcn' ? { variant: 'outline', size: 'sm' } : {},
              children: ['Reset'],
            },
          ],
        },
      ],
    }),
  };
}

export function createSliderMultipleDemo(family: SliderDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto grid w-full max-w-xs gap-3',
      children: [
        valuesPart(
          family,
          'root',
          {
            defaultValue: [10, 20, 70],
            min: 0,
            max: 100,
            step: 10,
            ariaLabel: 'Breakpoints',
          },
          [
            {
              kind: 'box',
              className: 'flex w-full items-center justify-between text-sm',
              children: [
                valuesPart(family, 'label', {}, ['Breakpoints']),
                valuesPart(family, 'value', {}, []),
              ],
            },
            valuesPart(family, 'track', {}, [
              valuesPart(family, 'indicator'),
              valuesPart(family, 'thumb', { index: 0, ariaLabel: 'First stop' }),
              valuesPart(family, 'thumb', { index: 1, ariaLabel: 'Second stop' }),
              valuesPart(family, 'thumb', { index: 2, ariaLabel: 'Third stop' }),
            ]),
          ]
        ),
      ],
    }),
  };
}

export function createSliderVerticalDemo(family: SliderDemoFamily): DemoSpec {
  const column = (value: number, label: string): DemoNode => ({
    kind: 'box',
    className: 'flex h-40 items-center justify-center',
    children: [
      scalarPart(
        family,
        'root',
        {
          defaultValue: value,
          min: 0,
          max: 100,
          step: 1,
          orientation: 'vertical',
          ariaLabel: label,
        },
        [
          scalarPart(family, 'track', {}, [
            scalarPart(family, 'indicator'),
            scalarPart(family, 'thumb'),
          ]),
        ]
      ),
    ],
  });

  return {
    type: 'demo',
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto flex w-full max-w-xs items-center justify-center gap-8 py-2',
      children: [column(50, 'Bass'), column(25, 'Treble')],
    }),
  };
}

export function createSliderControlledDemo(family: SliderDemoFamily): DemoSpec {
  return {
    type: 'demo',
    setup({ refs, api }: DemoSetupContext) {
      api.setProps('controlled', {
        onValueChange: (event: { value: number | readonly number[] }) => {
          api.setProps('controlled', { value: event.value });
          if (refs.readout) refs.readout.textContent = formatDecimalValues(event.value);
        },
      });
    },
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto grid w-full max-w-xs gap-3',
      children: [
        {
          kind: 'box',
          className: 'flex items-center justify-between gap-2 text-sm',
          children: [
            { kind: 'box', className: 'font-medium', children: ['Temperature'] },
            {
              kind: 'box',
              ref: 'readout',
              className: 'text-muted-foreground tabular-nums',
              children: ['0.3, 0.7'],
            },
          ],
        },
        valuesPart(
          family,
          'root',
          {
            value: [0.3, 0.7],
            min: 0,
            max: 1,
            step: 0.1,
            ariaLabel: 'Temperature',
          },
          [
            valuesPart(family, 'track', {}, [
              valuesPart(family, 'indicator'),
              valuesPart(family, 'thumb', { index: 0, ariaLabel: 'Minimum temperature' }),
              valuesPart(family, 'thumb', { index: 1, ariaLabel: 'Maximum temperature' }),
            ]),
          ],
          'controlled'
        ),
      ],
    }),
  };
}

export function createSliderDisabledDemo(family: SliderDemoFamily): DemoSpec {
  const rows: DemoNode[] = [
    scalarPart(
      family,
      'root',
      { defaultValue: 50, min: 0, max: 100, step: 1, disabled: true, ariaLabel: 'Disabled volume' },
      [
        {
          kind: 'box',
          className: 'flex w-full items-center justify-between text-sm',
          children: [
            scalarPart(family, 'label', {}, ['Disabled']),
            scalarPart(family, 'value', {}, []),
          ],
        },
        scalarPart(family, 'track', {}, [
          scalarPart(family, 'indicator'),
          scalarPart(family, 'thumb'),
        ]),
      ]
    ),
  ];

  if (family === 'liquid-glass') {
    rows.push(
      scalarPart(
        family,
        'root',
        { defaultValue: 65, min: 0, max: 100, step: 1, ariaLabel: 'Opaque thumb slider' },
        [
          {
            kind: 'box',
            className: 'flex w-full items-center justify-between text-sm',
            children: [
              scalarPart(family, 'label', {}, ['Opaque material']),
              scalarPart(family, 'value', {}, []),
            ],
          },
          scalarPart(family, 'track', {}, [
            scalarPart(family, 'indicator'),
            scalarPart(family, 'thumb', { material: 'opaque' }),
          ]),
        ]
      )
    );
  }

  return {
    type: 'demo',
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto grid w-full max-w-xs gap-5',
      children: rows,
    }),
  };
}

export function createSliderRtlDemo(family: SliderDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapSurface(family, {
      kind: 'box',
      className: 'mx-auto grid w-full max-w-xs gap-3',
      children: [
        scalarPart(
          family,
          'root',
          {
            defaultValue: 75,
            min: 0,
            max: 100,
            step: 1,
            direction: 'rtl',
            ariaLabel: 'RTL volume',
          },
          [
            {
              kind: 'box',
              className: 'flex w-full items-center justify-between text-sm',
              children: [
                scalarPart(family, 'label', {}, ['Direction: RTL']),
                scalarPart(family, 'value', {}, []),
              ],
            },
            scalarPart(family, 'track', {}, [
              scalarPart(family, 'indicator'),
              scalarPart(family, 'thumb'),
            ]),
          ]
        ),
      ],
    }),
  };
}
