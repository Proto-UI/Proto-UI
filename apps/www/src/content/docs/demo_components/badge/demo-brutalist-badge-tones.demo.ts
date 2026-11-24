export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'accent' },
        children: ['Draft'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'info' },
        children: ['Staging'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'danger' },
        children: ['Deprecated'],
      },
    ],
  },
};
