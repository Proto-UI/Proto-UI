import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-md min-w-0 gap-2 rounded border border-neutral-300 bg-neutral-100 p-4 shadow-inner dark:border-neutral-700 dark:bg-neutral-900',
    children: [
      {
        kind: 'box',
        tag: 'div',
        className: 'mb-2 text-sm font-bold',
        children: ['Server capacity summary'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-meter-root',
        props: { value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%' },
        children: [
          {
            kind: 'box',
            className: 'flex w-full items-center justify-between gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-meter-label',
                children: ['CPU allocation'],
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
              { kind: 'proto', prototypeId: 'bootstrap-2-3-2-meter-label', children: ['Memory'] },
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
                prototypeId: 'bootstrap-2-3-2-meter-label',
                children: ['SSD volume'],
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
