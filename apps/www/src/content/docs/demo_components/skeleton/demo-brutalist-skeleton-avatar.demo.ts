export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'h-12 w-12 shrink-0 rounded-full',
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-4 w-48',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-skeleton-root',
            className: 'h-4 w-36',
          },
        ],
      },
    ],
  },
};
