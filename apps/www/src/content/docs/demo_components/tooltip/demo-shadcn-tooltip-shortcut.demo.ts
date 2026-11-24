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
            ref: 'shortcutTrigger',
            className:
              'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted',
            children: ['Save'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-content',
            ref: 'shortcutContent',
            props: { side: 'top', align: 'center' },
            children: [
              'Save Changes',
              {
                kind: 'box',
                tag: 'span',
                className:
                  'inline-flex h-4 min-w-4 items-center justify-center rounded border border-background/25 bg-background/15 px-1 font-mono text-[10px] leading-none',
                children: ['S'],
              },
            ],
          },
        ],
      },
    ],
  },
});
