import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        props: { size: 'sm' },
        children: ['Small'],
      },
      { kind: 'proto', prototypeId: 'liquid-glass-button', children: ['Default'] },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        props: { size: 'lg', variant: 'prominent' },
        children: ['Large'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
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
