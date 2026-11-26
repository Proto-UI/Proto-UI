import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: '',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-8 liquid-functional-demo',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
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
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            props: { defaultActive: true },
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
        ],
      },
    ],
  },
} satisfies DemoSpec;
