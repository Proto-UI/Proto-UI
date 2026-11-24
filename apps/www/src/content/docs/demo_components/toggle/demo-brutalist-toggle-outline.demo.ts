import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { variant: 'outline' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-italic-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'Italic',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { variant: 'outline', defaultActive: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-bold-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'Bold',
        ],
      },
    ],
  },
} satisfies DemoSpec;
