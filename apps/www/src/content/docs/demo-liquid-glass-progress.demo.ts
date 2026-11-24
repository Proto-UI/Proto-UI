import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'w-[60%] min-w-0',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-progress-root',
            ref: 'progress',
            props: { value: 13, min: 0, max: 100, ariaLabel: 'Task progress', valueText: '13%' },
            children: [
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
