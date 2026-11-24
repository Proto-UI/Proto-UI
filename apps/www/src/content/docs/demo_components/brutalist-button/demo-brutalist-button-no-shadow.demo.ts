import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'noShadow' },
        children: ['No Shadow'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'noShadow', color: 'mint' },
        children: ['Mint'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'noShadow', color: 'coral' },
        children: ['Coral'],
      },
    ],
  },
} satisfies DemoSpec;
