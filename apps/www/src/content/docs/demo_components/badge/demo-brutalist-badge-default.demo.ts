export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        children: ['Badge'],
      },
    ],
  },
};
