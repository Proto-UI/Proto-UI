import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    className: 'w-full max-w-sm pt-0',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-image-root',
        props: {
          source: '/images/base-image/landscape.svg',
          a11yMode: 'informative',
          alternativeText: 'Design systems meetup cover illustration',
          fit: 'cover',
        },
        surfaceStyle: {
          display: 'block',
          width: '100%',
          height: '180px',
        },
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                props: { size: 'base', weight: 'medium', tone: 'inherit' },
                children: ['Design systems meetup'],
              },
              {
                kind: 'box',
                tag: 'span',
                className:
                  'inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground',
                children: ['Featured'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'muted' },
            children: ['A practical talk on component APIs, accessibility, and shipping faster.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-footer',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            className: 'w-full',
            children: ['View Event'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
