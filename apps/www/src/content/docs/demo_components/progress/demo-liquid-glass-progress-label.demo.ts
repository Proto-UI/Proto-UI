import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm min-w-0',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-progress-root',
            props: { value: 56, min: 0, max: 100, valueText: '56%' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-progress-label',
                children: ['Upload progress'],
              },
              { kind: 'proto', prototypeId: 'liquid-glass-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-progress-track',
                children: [{ kind: 'proto', prototypeId: 'liquid-glass-progress-indicator' }],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
