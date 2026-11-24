import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
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
            prototypeId: 'shadcn-progress-root',
            props: { value: 56, min: 0, max: 100, valueText: '56%' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-progress-label',
                children: ['Upload progress'],
              },
              { kind: 'proto', prototypeId: 'shadcn-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'shadcn-progress-track',
                children: [{ kind: 'proto', prototypeId: 'shadcn-progress-indicator' }],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
