export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: [
      'Today',
      {
        kind: 'proto',
        prototypeId: 'base-separator-root',
        className: 'block h-px w-full bg-black',
      },
      'Yesterday',
      {
        kind: 'box',
        className: 'flex h-12 items-stretch gap-3',
        children: [
          'Vertical',
          {
            kind: 'proto',
            prototypeId: 'base-separator-root',
            props: { orientation: 'vertical', decorative: false },
            className: 'block h-full w-px bg-black',
          },
          'Rule',
        ],
      },
    ],
  },
};
