export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'sm' },
            children: [{ kind: 'box', ref: 'spinner-canary', children: ['SPINNER-CANARY'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'md' },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'lg' },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
          },
          { kind: 'box', children: ['Loading…'] },
        ],
      },
    ],
  },
};
