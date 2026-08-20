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
                children: ['Flat overlay, hard panel shadow, zero radius.'],
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
