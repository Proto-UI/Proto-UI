import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex h-5 items-center gap-4 text-sm font-medium',
    children: [
      { kind: 'box', children: ['Blog'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-separator-root',
        props: { orientation: 'vertical' },
      },
      { kind: 'box', children: ['Docs'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-separator-root',
        props: { orientation: 'vertical' },
      },
      { kind: 'box', children: ['Source'] },
    ],
  },
} satisfies DemoSpec;
