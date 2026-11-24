import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center py-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tooltip-root',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-trigger',
            ref: 'basicTrigger',
            className:
              'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted',
            children: ['Hover'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-content',
            ref: 'basicContent',
            props: { side: 'top', align: 'center' },
            children: ['Add to library'],
          },
        ],
      },
    ],
  },
});
