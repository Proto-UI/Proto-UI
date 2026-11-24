export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'accent' },
        children: [
          {
            kind: 'box',
            className: 'inline-flex items-center gap-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-spinner-root',
                props: { size: 'sm' },
              },
              'Syncing',
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'info' },
        children: [
          {
            kind: 'box',
            className: 'inline-flex items-center gap-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-spinner-root',
                props: { size: 'sm' },
              },
              'Updating',
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'danger' },
        children: [
          {
            kind: 'box',
            className: 'inline-flex items-center gap-1.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-spinner-root',
                props: { size: 'sm' },
              },
              'Processing',
            ],
          },
        ],
      },
    ],
  },
};
