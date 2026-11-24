import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function arrowIcon(sizePx: number) {
  return {
    kind: 'proto' as const,
    prototypeId: 'lucide-arrow-right-icon',
    className: 'inline-flex shrink-0 pointer-events-none',
    props: { size: sizePx },
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'xs' },
            children: ['Extra Small'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'icon-xs' },
            children: [
              arrowIcon(12),
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Extra small icon'] },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'sm' },
            children: ['Small'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'icon-sm' },
            children: [
              arrowIcon(14),
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Small icon'] },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            children: ['Default'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'icon' },
            children: [
              arrowIcon(16),
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Default icon'] },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'lg' },
            children: ['Large'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { size: 'icon-lg' },
            children: [
              arrowIcon(18),
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Large icon'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
