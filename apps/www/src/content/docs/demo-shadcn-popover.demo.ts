import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const DEFAULTS = [
  { ref: 'width', key: 'shadcn-popover-width', label: 'Width', value: '100%' },
  { ref: 'maxWidth', key: 'shadcn-popover-max-width', label: 'Max. width', value: '300px' },
  { ref: 'height', key: 'shadcn-popover-height', label: 'Height', value: '25px' },
  { ref: 'maxHeight', key: 'shadcn-popover-max-height', label: 'Max. height', value: 'none' },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-trigger',
            children: ['Open popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-content',
            className: 'w-80',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-description',
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
                      prototypeId: 'shadcn-label-root',
                      associations: { controlLabel: field.key },
                      children: [field.label],
                    },
                    {
                      kind: 'box' as const,
                      className: 'col-span-2 min-w-0',
                      children: [
                        {
                          kind: 'proto' as const,
                          prototypeId: 'shadcn-input-root',
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
                    prototypeId: 'shadcn-button',
                    ref: 'reset',
                    props: { variant: 'ghost', size: 'sm' },
                    children: ['Reset'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-close',
                    children: ['Done'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    api.setProps('reset', {
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        for (const field of DEFAULTS) {
          api.call(field.ref, 'resetValue', field.value);
        }
      },
    });
  },
} satisfies DemoSpec);
