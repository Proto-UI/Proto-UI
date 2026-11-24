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
            ref: 'disabledWrapperTrigger',
            className: 'inline-block w-fit',
            children: [
              {
                kind: 'box',
                tag: 'span',
                attrs: { 'aria-disabled': 'true' },
                className:
                  'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground opacity-50 shadow-xs cursor-not-allowed',
                children: ['Disabled'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-content',
            ref: 'disabledContent',
            props: { side: 'top', align: 'center' },
            children: ['This feature is currently unavailable'],
          },
        ],
      },
    ],
  },
});
