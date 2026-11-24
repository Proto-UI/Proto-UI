import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-md min-w-0 gap-5 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-meter-root',
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
              { kind: 'proto', prototypeId: 'shadcn-meter-label', children: ['Cloud storage'] },
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
              { kind: 'proto', prototypeId: 'shadcn-meter-label', children: ['Monthly API calls'] },
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
