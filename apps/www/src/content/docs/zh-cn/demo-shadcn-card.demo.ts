import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'base', weight: 'medium', tone: 'inherit' },
            children: ['Deployment summary'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'muted' },
            children: ['Production release v2.4 is live across all regions.'],
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
            props: { size: 'sm', tone: 'inherit' },
            children: [
              'All 12 edge workers passed health checks with 99.98% uptime over the last 24 hours.',
            ],
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
            className: 'text-sm font-medium underline underline-offset-4 hover:opacity-80',
            attrs: { href: '#card-contract' },
            children: ['View usage guide'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
