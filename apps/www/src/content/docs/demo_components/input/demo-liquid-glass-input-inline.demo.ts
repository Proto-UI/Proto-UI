import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
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
