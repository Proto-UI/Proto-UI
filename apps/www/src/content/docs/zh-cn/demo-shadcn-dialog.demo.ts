export default {
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
                children: ['Edit Profile'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                children: ["Make changes to your profile here. Click save when you're done."],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-footer',
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
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-close-icon',
          },
        ],
      },
    ],
  },
};
