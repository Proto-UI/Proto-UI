import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className:
          'flex h-10 items-center gap-4 rounded-xl bg-background/75 px-4 py-2 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md',
        children: [
          { kind: 'box', children: ['Blog'] },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { orientation: 'vertical' },
          },
          { kind: 'box', children: ['Docs'] },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { orientation: 'vertical' },
          },
          { kind: 'box', children: ['Source'] },
        ],
      },
    ],
  },
} satisfies DemoSpec;
