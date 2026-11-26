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
            props: { material: 'auto' },
            children: ['Auto Glass'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            props: { material: 'auto', defaultActive: true },
            children: ['Auto Active'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            props: { material: 'opaque' },
            children: ['Opaque'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            props: { material: 'opaque', defaultActive: true },
            children: ['Opaque Active'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
