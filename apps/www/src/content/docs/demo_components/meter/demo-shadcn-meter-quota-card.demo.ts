import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-md min-w-0 gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1',
        children: [
          {
            kind: 'box',
            tag: 'div',
            className: 'text-sm font-semibold',
            children: ['Workspace quota'],
          },
          {
            kind: 'box',
            tag: 'div',
            className: 'text-xs text-muted-foreground',
            children: ['Current billing cycle utilization across compute and storage.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-meter-root',
        props: { value: 28, min: 0, max: 100, low: 60, high: 85, optimum: 20, valueText: '28%' },
        children: [
          {
            kind: 'box',
            className: 'flex w-full items-center justify-between gap-2',
            children: [
              { kind: 'proto', prototypeId: 'shadcn-meter-label', children: ['CPU allocation'] },
              { kind: 'proto', prototypeId: 'shadcn-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-meter-track',
            children: [{ kind: 'proto', prototypeId: 'shadcn-meter-indicator' }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-meter-root',
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
              { kind: 'proto', prototypeId: 'shadcn-meter-label', children: ['Memory'] },
              { kind: 'proto', prototypeId: 'shadcn-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-meter-track',
            children: [{ kind: 'proto', prototypeId: 'shadcn-meter-indicator' }],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-meter-root',
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
              { kind: 'proto', prototypeId: 'shadcn-meter-label', children: ['SSD volume'] },
              { kind: 'proto', prototypeId: 'shadcn-meter-value' },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-meter-track',
            children: [{ kind: 'proto', prototypeId: 'shadcn-meter-indicator' }],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
