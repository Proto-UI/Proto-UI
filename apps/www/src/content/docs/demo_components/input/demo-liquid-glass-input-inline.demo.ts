import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-input-root',
            props: {
              placeholder: 'Search...',
              inputMode: 'search',
              enterKeyHint: 'search',
              ariaLabel: 'Search',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-button',
            children: ['Search'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
