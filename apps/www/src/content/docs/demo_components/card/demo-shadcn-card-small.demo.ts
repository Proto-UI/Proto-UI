import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const items = [
  'Choose a schedule (daily, or weekly).',
  'Send to channels or specific teammates.',
  'Include charts, tables, and key metrics.',
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    props: { size: 'sm' },
    className: 'w-full max-w-xs',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'base', weight: 'medium', tone: 'inherit' },
            children: ['Scheduled reports'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'muted' },
            children: ['Weekly snapshots. No more manual exports.'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-content',
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
        prototypeId: 'shadcn-card-footer',
        className: 'flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'sm' },
            className: 'w-full',
            children: ['Set up scheduled reports'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            className: 'w-full',
            children: ["See what's new"],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
