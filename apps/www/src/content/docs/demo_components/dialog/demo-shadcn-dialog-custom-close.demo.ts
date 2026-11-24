import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-dialog-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-trigger',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline' },
            children: ['Share'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-mask',
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-header',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-title',
                children: ['Share link'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                children: ['Anyone who has this link will be able to view this.'],
              },
            ],
          },
          {
            kind: 'box',
            className: 'grid gap-2',
            children: [
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs font-medium text-muted-foreground',
                children: ['Link'],
              },
              {
                kind: 'box',
                className:
                  'rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground break-all',
                children: ['https://pui.cyjin.dev/en/ui-libraries/shadcn/dialog/'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-footer',
            className: 'justify-start',
            children: [
              {
                kind: 'box',
                className: 'min-w-0 max-w-full',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dialog-close',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'secondary', wrap: true },
                        children: ['Close'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-close-icon',
          },
        ],
      },
    ],
  },
});
