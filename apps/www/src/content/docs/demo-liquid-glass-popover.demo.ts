import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const DEFAULTS = [
  { ref: 'width', key: 'lg-popover-width', label: 'Width', value: '100%' },
  { ref: 'maxWidth', key: 'lg-popover-max-width', label: 'Max. width', value: '300px' },
  { ref: 'height', key: 'lg-popover-height', label: 'Height', value: '25px' },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            children: ['Open popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-description',
                    children: ['Set the dimensions for the layer.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-2',
                children: DEFAULTS.map((field) => ({
                  kind: 'box' as const,
                  className: 'grid grid-cols-3 items-center gap-3',
                  children: [
                    {
                      kind: 'proto' as const,
                      prototypeId: 'liquid-glass-label-root',
                      associations: { controlLabel: field.key },
                      children: [field.label],
                    },
                    {
                      kind: 'box' as const,
                      className: 'col-span-2 min-w-0',
                      children: [
                        {
                          kind: 'proto' as const,
                          prototypeId: 'liquid-glass-input-root',
                          ref: field.ref,
                          className: 'w-full min-w-0',
                          associations: { controlLabel: field.key },
                          props: {
                            defaultValue: field.value,
                          },
                        },
                      ],
                    },
                  ],
                })),
              },
              {
                kind: 'box',
                className: 'flex items-center justify-end gap-2 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-close',
                    props: { prominence: 'prominent' },
                    children: ['Done'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'reset',
        children: ['Reset layer'],
      },
    ],
  },
  setup({ api }) {
    api.setProps('reset', {
      onClick: () => {
        for (const field of DEFAULTS) {
          api.call(field.ref, 'resetValue', field.value);
        }
      },
    });
  },
} satisfies DemoSpec;
