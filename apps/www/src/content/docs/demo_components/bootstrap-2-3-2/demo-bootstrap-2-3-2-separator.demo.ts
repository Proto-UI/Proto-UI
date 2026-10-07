import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          'Proto UI',
          {
            kind: 'box',
            className: 'text-sm text-muted-foreground',
            children: ['A component interaction protocol.'],
          },
        ],
      },
      { kind: 'proto', prototypeId: 'bootstrap-2-3-2-separator-root' },
      {
        kind: 'box',
        className: 'flex h-5 items-center gap-4 text-sm',
        children: [
          'Blog',
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-separator-root',
            props: { orientation: 'vertical' },
          },
          'Docs',
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-separator-root',
            props: { orientation: 'vertical' },
          },
          'Source',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-separator-root',
        props: { decorative: false },
      },
      {
        kind: 'box',
        className: 'text-sm text-muted-foreground',
        children: ['The rule above is semantic and reaches the accessibility tree.'],
      },
    ],
  },
} satisfies DemoSpec;
