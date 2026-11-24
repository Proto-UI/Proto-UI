import { withShadcnRheaDemo } from '../../shadcn-demo-style';

function arrowIcon(sizePx: number) {
  return {
    kind: 'proto' as const,
    prototypeId: 'lucide-arrow-right-icon',
    className: 'inline-flex shrink-0 pointer-events-none',
    props: { size: sizePx },
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'xs', variant: 'outline' },
            children: ['Extra Small'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'icon-xs', variant: 'outline' },
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
            prototypeId: 'shadcn-button',
            props: { size: 'sm', variant: 'outline' },
            children: ['Small'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'icon-sm', variant: 'outline' },
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
            prototypeId: 'shadcn-button',
            props: { variant: 'outline' },
            children: ['Default'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'icon', variant: 'outline' },
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
            prototypeId: 'shadcn-button',
            props: { size: 'lg', variant: 'outline' },
            children: ['Large'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { size: 'icon-lg', variant: 'outline' },
            children: [
              arrowIcon(18),
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Large icon'] },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { size: 'icon-compact', variant: 'outline' },
        children: [
          arrowIcon(14),
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Compact icon'] },
        ],
      },
    ],
  },
});
