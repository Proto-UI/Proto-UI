import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { size: 'icon' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-arrow-right-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Continue'] },
        ],
      },
    ],
  },
} satisfies DemoSpec;
