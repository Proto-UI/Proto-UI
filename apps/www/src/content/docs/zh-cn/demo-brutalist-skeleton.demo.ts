export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'w-32 h-4',
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'w-64 h-12',
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-skeleton-root',
        className: 'w-56 h-4',
      },
    ],
  },
};
