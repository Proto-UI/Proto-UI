export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xs flex-col gap-5',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-4 w-20',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-9 w-full',
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-4 w-24',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-9 w-full',
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'h-9 w-24',
      },
    ],
  },
};
