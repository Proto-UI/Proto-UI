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
        props: { material: 'auto' },
        children: ['Auto Glass'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        props: { material: 'opaque' },
        children: ['Opaque'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        props: { variant: 'prominent', material: 'opaque' },
        children: ['Prominent Opaque'],
      },
    ],
  },
} satisfies DemoSpec;
