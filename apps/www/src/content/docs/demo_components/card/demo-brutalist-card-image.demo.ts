import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-card-root',
    className: 'w-full max-w-sm overflow-hidden pt-0',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-image-root',
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
          borderWidth: '0 0 2px 0',
          borderRadius: '0',
        },
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-header',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1',
            children: [
              {
                kind: 'box',
                className: 'font-heading text-base font-bold leading-snug',
                children: ['Design systems meetup'],
              },
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: [
                  'A practical talk on component APIs, accessibility, and shipping faster.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-badge-root',
            props: { tone: 'accent' },
            children: ['Featured'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-footer',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'solid' },
            className: 'w-full',
            children: ['View Event'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
