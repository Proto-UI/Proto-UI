export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-scroll-area-root',
    className: 'relative h-48 w-full max-w-80 overflow-hidden rounded border',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-scroll-area-viewport',
        className: 'h-full w-full overflow-auto',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-2 p-3',
            children: [
              'Host-projected scrolling surface',
              'Row 2',
              'Row 3',
              'Row 4',
              'Row 5',
              'Row 6',
              'Row 7',
              'Row 8',
              'Row 9',
              'Row 10',
              'Row 11',
              'Row 12',
              'Row 13',
              'Row 14',
              'Row 15',
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-scroll-area-scrollbar',
        props: { orientation: 'vertical' },
        className: 'absolute inset-y-0 right-0 w-2 bg-gray-100',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-scroll-area-thumb',
            className: 'block min-h-8 w-full rounded bg-gray-500',
          },
        ],
      },
    ],
  },
};
