import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from './shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'box',
        className: 'w-[60%] min-w-0',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-progress-root',
            ref: 'progress',
            props: { value: 13, min: 0, max: 100, ariaLabel: 'Task progress', valueText: '13%' },
            children: [
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
  setup({ api }) {
    const timer = setTimeout(() => {
      api.setProps('progress', {
        value: 66,
        min: 0,
        max: 100,
        ariaLabel: 'Task progress',
        valueText: '66%',
      });
    }, 500);
    return () => clearTimeout(timer);
  },
} satisfies DemoSpec);
