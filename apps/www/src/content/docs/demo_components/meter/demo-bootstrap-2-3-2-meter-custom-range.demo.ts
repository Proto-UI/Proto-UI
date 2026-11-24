import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-md min-w-0 gap-2 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-meter-root',
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
                prototypeId: 'bootstrap-2-3-2-meter-label',
                children: ['Cloud storage'],
              },
              { kind: 'proto', prototypeId: 'bootstrap-2-3-2-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-meter-track',
            children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-meter-indicator' }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-meter-root',
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
                prototypeId: 'bootstrap-2-3-2-meter-label',
                children: ['Monthly API calls'],
              },
              { kind: 'proto', prototypeId: 'bootstrap-2-3-2-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-meter-track',
            children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-meter-indicator' }],
          },
        ],
      },
    ],
  },
};

export default demo;
