export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xs flex-col gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'h-4 w-full',
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'h-4 w-full',
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'h-4 w-3/4',
      },
    ],
  },
};
