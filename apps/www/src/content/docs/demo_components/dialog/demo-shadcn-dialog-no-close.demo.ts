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
            children: ['No Close Button'],
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
                children: ['No Close Button'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                children: [
                  "This dialog doesn't have a close button in the top-right corner. Dismiss it with Escape, the backdrop, or the action below.",
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
                        children: ['Done'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});
