export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dialog-root',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-dialog-trigger', children: ['Edit Profile'] },
      { kind: 'proto', prototypeId: 'brutalist-dialog-mask' },
      {
        kind: 'proto',
        prototypeId: 'brutalist-dialog-content',
        children: [
          {
            kind: 'box',
            className: 'min-w-0 pe-12',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dialog-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-title',
                    children: ['Edit profile'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-description',
                    children: ["Make changes to your profile here. Click save when you're done."],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className: 'grid gap-3',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-sm font-medium',
                    children: ['Name'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-base border-2 border-black bg-secondary-background px-3 py-2 text-sm',
                    children: ['Pedro Duarte'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-sm font-medium',
                    children: ['Username'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-base border-2 border-black bg-secondary-background px-3 py-2 text-sm',
                    children: ['@peduarte'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dialog-footer',
            children: [
              {
                kind: 'box',
                className: 'min-w-0 max-w-full',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-close',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-button',
                        props: { variant: 'neutral', wrap: true },
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
                    prototypeId: 'brutalist-dialog-close',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-button',
                        props: { wrap: true },
                        children: ['Save changes'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { kind: 'proto', prototypeId: 'brutalist-dialog-close-icon' },
        ],
      },
    ],
  },
};
