import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-bold-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 14 },
          },
          'Bold',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { defaultActive: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-italic-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 14 },
          },
          'Italic',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-underline-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 14 },
          },
          'Underline',
        ],
      },
    ],
  },
} satisfies DemoSpec;
