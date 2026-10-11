export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dialog-root',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-dialog-trigger', children: ['Open dialog'] },
      { kind: 'proto', prototypeId: 'brutalist-dialog-mask' },
      {
        kind: 'proto',
        prototypeId: 'brutalist-dialog-content',
        children: [
          {
            // Consumer composition reserves a scalable row for the optional,
            // absolutely positioned CloseIcon. Content keeps p-6 and Header
            // keeps its full inline width, including at 200% text/page scale.
            // 1.5rem + 2.5rem starts the title below top-4 + size-9 (3.25rem).
            kind: 'box',
            className: 'min-w-0 pt-10',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dialog-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-title',
                    children: ['Neo-Brutalist modal'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-dialog-description',
                    children: ['Flat overlay, hard panel shadow, 5px rounded corners.'],
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
                kind: 'proto',
                prototypeId: 'brutalist-dialog-close',
                children: [{ kind: 'proto', prototypeId: 'brutalist-button', children: ['Close'] }],
              },
            ],
          },
          { kind: 'proto', prototypeId: 'brutalist-dialog-close-icon' },
        ],
      },
    ],
  },
};
