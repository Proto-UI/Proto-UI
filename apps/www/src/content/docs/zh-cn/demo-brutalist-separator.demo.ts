export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: [
      'Today',
      { kind: 'proto', prototypeId: 'brutalist-separator-root' },
      'Yesterday',
      {
        kind: 'box',
        className: 'flex items-stretch gap-3 h-12',
        children: [
          'Vertical',
          {
            kind: 'proto',
            prototypeId: 'brutalist-separator-root',
            props: { orientation: 'vertical' },
          },
          'Rule',
        ],
      },
    ],
  },
};
