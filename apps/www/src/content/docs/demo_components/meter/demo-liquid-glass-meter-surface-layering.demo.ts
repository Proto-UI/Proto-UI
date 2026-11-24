import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'mx-auto grid w-full max-w-md min-w-0 gap-4',
        children: [
          {
            kind: 'box',
            className: 'grid gap-4 rounded-2xl border border-border bg-background/90 p-5 shadow-xs',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'box',
                    tag: 'div',
                    className: 'text-sm font-semibold',
                    children: ['Device resources'],
                  },
                  {
                    kind: 'box',
                    tag: 'div',
                    className: 'text-xs text-muted-foreground',
                    children: [
                      'Meters stay in the crisp content layer while actions float in Liquid Glass.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-meter-root',
                ref: 'memory',
                props: {
                  value: 11.4,
                  min: 0,
                  max: 16,
                  low: 10,
                  high: 14,
                  optimum: 4,
                  valueText: '11.4 GB / 16 GB',
                },
                children: [
                  {
                    kind: 'box',
                    className: 'flex w-full items-center justify-between gap-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-meter-label',
                        children: ['Memory'],
                      },
                      { kind: 'proto', prototypeId: 'liquid-glass-meter-value' },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-track',
                    children: [{ kind: 'proto', prototypeId: 'liquid-glass-meter-indicator' }],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-meter-root',
                ref: 'storage',
                props: {
                  value: 468,
                  min: 0,
                  max: 500,
                  low: 300,
                  high: 425,
                  optimum: 100,
                  valueText: '468 GB / 500 GB',
                },
                children: [
                  {
                    kind: 'box',
                    className: 'flex w-full items-center justify-between gap-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-meter-label',
                        children: ['Local storage'],
                      },
                      { kind: 'proto', prototypeId: 'liquid-glass-meter-value' },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-track',
                    children: [{ kind: 'proto', prototypeId: 'liquid-glass-meter-indicator' }],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className: 'flex flex-wrap items-center justify-end gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                ref: 'optimize',
                children: ['Free cache'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                ref: 'reset',
                children: ['Restore load'],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    api.setProps('optimize', {
      onClick: () => {
        api.setProps('memory', {
          value: 6.2,
          min: 0,
          max: 16,
          low: 10,
          high: 14,
          optimum: 4,
          valueText: '6.2 GB / 16 GB',
        });
        api.setProps('storage', {
          value: 240,
          min: 0,
          max: 500,
          low: 300,
          high: 425,
          optimum: 100,
          valueText: '240 GB / 500 GB',
        });
      },
    });
    api.setProps('reset', {
      onClick: () => {
        api.setProps('memory', {
          value: 11.4,
          min: 0,
          max: 16,
          low: 10,
          high: 14,
          optimum: 4,
          valueText: '11.4 GB / 16 GB',
        });
        api.setProps('storage', {
          value: 468,
          min: 0,
          max: 500,
          low: 300,
          high: 425,
          optimum: 100,
          valueText: '468 GB / 500 GB',
        });
      },
    });
  },
};

export default demo;
