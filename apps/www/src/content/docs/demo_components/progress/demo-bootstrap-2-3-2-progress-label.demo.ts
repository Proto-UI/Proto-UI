import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm min-w-0',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-progress-root',
            props: { value: 56, min: 0, max: 100, valueText: '56%' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-progress-label',
                children: ['Upload progress'],
              },
              { kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-progress-track',
                children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-progress-indicator' }],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
