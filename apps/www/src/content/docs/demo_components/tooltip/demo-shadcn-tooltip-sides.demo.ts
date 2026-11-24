import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const sides = [
  ['left', 'Left'],
  ['top', 'Top'],
  ['bottom', 'Bottom'],
  ['right', 'Right'],
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tooltip-group',
    props: { openDelay: 0, closeDelay: 100, skipDelay: 300 },
    className: 'flex flex-wrap items-center justify-center gap-2 py-8',
    children: sides.map(([side, label]) => ({
      kind: 'proto' as const,
      prototypeId: 'shadcn-tooltip-root',
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-tooltip-trigger',
          ref: `sideTrigger-${side}`,
          className:
            'inline-flex h-8 w-fit items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted',
          children: [label],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-tooltip-content',
          ref: `sideContent-${side}`,
          props: { side, align: 'center' },
          children: ['Add to library'],
        },
      ],
    })),
  },
});
