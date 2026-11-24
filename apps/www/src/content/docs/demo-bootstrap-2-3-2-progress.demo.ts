import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
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
            prototypeId: 'bootstrap-2-3-2-progress-root',
            ref: 'progress',
            props: { value: 13, min: 0, max: 100, ariaLabel: 'Task progress', valueText: '13%' },
            children: [
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
} satisfies DemoSpec;
