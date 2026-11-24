import { withShadcnRheaDemo } from '../shadcn-demo-style';

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
            children: ['Open Dialog'],
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
                children: ['Edit profile'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                children: ["Make changes to your profile here. Click save when you're done."],
              },
            ],
          },
          {
            kind: 'box',
            className: 'grid gap-4',
            children: [
              {
                kind: 'box',
                className: 'grid gap-2',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-sm font-medium text-foreground',
                    children: ['Name'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                    children: ['Pedro Duarte'],
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
                    className: 'text-sm font-medium text-foreground',
                    children: ['Username'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                    children: ['@peduarte'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-footer',
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
                        props: { variant: 'outline', wrap: true },
                        children: ['Cancel'],
                      },
                    ],
                  },
                ],
              },
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
                        props: { wrap: true },
                        children: ['Save changes'],
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
