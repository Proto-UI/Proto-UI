export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-hover-card-root',
    props: { openDelay: 0, closeDelay: 0 },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-trigger',
        className: 'cursor-pointer',
        children: ['Hover preview'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-content',
        children: ['A rounded, flat preview panel.'],
      },
    ],
  },
};
