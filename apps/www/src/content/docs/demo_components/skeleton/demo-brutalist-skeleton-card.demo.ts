export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-card-root',
    className: 'w-full max-w-xs',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-header',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-4 w-2/3',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-4 w-1/2',
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-32 w-full',
          },
        ],
      },
    ],
  },
};
