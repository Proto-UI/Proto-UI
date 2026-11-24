import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const items = [
  'Choose a schedule (daily, or weekly).',
  'Send to channels or specific teammates.',
  'Include charts, tables, and key metrics.',
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-card-root',
    props: { size: 'sm' },
    className: 'w-full max-w-xs',
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
                children: ['Scheduled reports'],
              },
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['Weekly snapshots. No more manual exports.'],
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
            className: 'grid gap-2 py-1 text-sm',
            children: items.map((label) => ({
              kind: 'box' as const,
              className: 'flex items-start gap-2',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'lucide-chevron-right-icon',
                  props: { size: 16 },
                  className: 'mt-0.5 shrink-0 text-muted-foreground',
                },
                {
                  kind: 'box' as const,
                  tag: 'span' as const,
                  children: [label],
                },
              ],
            })),
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-footer',
        className: 'flex-col items-stretch gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'solid', size: 'sm' },
            className: 'w-full',
            children: ['Set up scheduled reports'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface', size: 'sm' },
            className: 'w-full',
            children: ["See what's new"],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
