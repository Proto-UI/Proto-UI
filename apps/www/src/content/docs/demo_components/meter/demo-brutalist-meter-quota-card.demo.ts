import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-md min-w-0 gap-4 rounded-[5px] border-2 border-black bg-white p-5 text-black shadow-[4px_4px_0_0_#000] dark:bg-neutral-900 dark:text-neutral-100',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1',
        children: [
          {
            kind: 'box',
            tag: 'div',
            className: 'text-sm font-bold',
            children: ['Workspace quota'],
          },
          {
            kind: 'box',
            tag: 'div',
            className: 'text-xs opacity-75',
            children: ['Current billing cycle utilization across compute and storage.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-meter-root',
        props: { value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%' },
        children: [
          {
            kind: 'box',
            className: 'flex w-full items-center justify-between gap-2',
            children: [
              { kind: 'proto', prototypeId: 'brutalist-meter-label', children: ['CPU allocation'] },
              { kind: 'proto', prototypeId: 'brutalist-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-meter-track',
            children: [{ kind: 'proto', prototypeId: 'brutalist-meter-indicator' }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-meter-root',
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
              { kind: 'proto', prototypeId: 'brutalist-meter-label', children: ['Memory'] },
              { kind: 'proto', prototypeId: 'brutalist-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-meter-track',
            children: [{ kind: 'proto', prototypeId: 'brutalist-meter-indicator' }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-meter-root',
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
              { kind: 'proto', prototypeId: 'brutalist-meter-label', children: ['SSD volume'] },
              { kind: 'proto', prototypeId: 'brutalist-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-meter-track',
            children: [{ kind: 'proto', prototypeId: 'brutalist-meter-indicator' }],
          },
        ],
      },
    ],
  },
};

export default demo;
