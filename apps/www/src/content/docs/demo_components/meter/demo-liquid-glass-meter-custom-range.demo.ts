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
        className:
          'mx-auto grid w-full max-w-md min-w-0 gap-5 rounded-xl border border-border bg-background/85 p-5 shadow-xs',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-meter-root',
            props: {
              value: 384,
              min: 0,
              max: 512,
              low: 256,
              high: 420,
              optimum: 128,
              valueText: '384 GB / 512 GB',
            },
            children: [
              {
                kind: 'box',
                className: 'flex w-full items-center justify-between gap-2',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-label',
                    children: ['iCloud storage'],
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
            props: {
              value: 9200,
              min: 0,
              max: 10000,
              low: 5000,
              high: 8500,
              optimum: 1000,
              valueText: '9,200 / 10,000 req',
            },
            children: [
              {
                kind: 'box',
                className: 'flex w-full items-center justify-between gap-2',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-meter-label',
                    children: ['Monthly API calls'],
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
    ],
  },
};

export default demo;
