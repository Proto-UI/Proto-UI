import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    className: 'max-w-lg',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { weight: 'semibold', tone: 'inherit' },
            children: ['Project notes'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'muted' },
            children: ['A passive content group'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { tone: 'inherit' },
            children: ['The card owns its frame and theme ink. Your content keeps its meaning.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-footer',
        children: [
          {
            kind: 'box',
            tag: 'a',
            attrs: { href: '#card-contract' },
            children: ['Read the contract'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
