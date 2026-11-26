import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const DEFAULTS = [
  { ref: 'width', key: 'bs2-popover-width', label: 'Width', value: '100%' },
  { ref: 'height', key: 'bs2-popover-height', label: 'Height', value: '25px' },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-trigger',
            children: ['Click to toggle popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-title',
                children: ['Dimensions'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-description',
                children: ['Set the dimensions for the layer.'],
              },
              {
                kind: 'box',
                className: 'grid gap-2 px-[14px] pb-[10px]',
                children: [
                  ...DEFAULTS.map((field) => ({
                    kind: 'box' as const,
                    className: 'grid grid-cols-3 items-center gap-2',
                    children: [
                      {
                        kind: 'proto' as const,
                        prototypeId: 'bootstrap-2-3-2-label-root',
                        associations: { controlLabel: field.key },
                        children: [field.label],
                      },
                      {
                        kind: 'box' as const,
                        className: 'col-span-2 min-w-0',
                        children: [
                          {
                            kind: 'proto' as const,
                            prototypeId: 'bootstrap-2-3-2-input-root',
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
                  {
                    kind: 'box',
                    className: 'flex items-center justify-end gap-2 pt-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-button',
                        ref: 'reset',
                        props: { variant: 'default', size: 'small' },
                        children: ['Reset'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-popover-close',
                        children: ['Close'],
                      },
                    ],
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
      variant: 'default',
      size: 'small',
      onClick: () => {
        for (const field of DEFAULTS) {
          api.call(field.ref, 'resetValue', field.value);
        }
      },
    });
  },
} satisfies DemoSpec;
