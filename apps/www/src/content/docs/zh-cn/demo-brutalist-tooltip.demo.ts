export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center gap-5 p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-root',
        props: { openDelay: 0, closeDelay: 0 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tooltip-trigger',
            children: ['Hover or focus for details'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tooltip-content',
            children: ['Portable Base behavior, Brutalist visual grammar'],
          },
        ],
      },
    ],
  },
};
