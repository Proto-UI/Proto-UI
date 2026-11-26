import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-wrap justify-center gap-5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-root',
        className: 'w-full max-w-sm',
        children: [
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
                    children: ['Weekly deployment'],
                  },
                  {
                    kind: 'box',
                    className: 'text-sm text-muted-foreground',
                    children: ['Release v2.4 is ready to publish to production.'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-card-content',
            children: [
              {
                kind: 'box',
                className: 'text-sm leading-relaxed',
                children: [
                  '12 automated checks passed across all edge regions with zero regressions.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-card-footer',
            className: 'flex-wrap',
            children: [
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs text-muted-foreground',
                children: ['Updated 2m ago'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-button',
                props: { size: 'sm' },
                children: ['Publish release'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
