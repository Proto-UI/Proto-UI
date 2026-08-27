export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-80 flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-scroll-area-root',
        className: 'relative h-48 w-full overflow-hidden rounded border',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-scroll-area-viewport',
            className: 'h-full w-full overflow-auto',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-2 p-3 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Host-projected scrolling surface'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 2'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 3'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 4'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 5'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 6'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 7'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 8'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 9'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 10'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 11'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 12'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 13'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 14'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Row 15'],
                  },
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
      {
        kind: 'box',
        className: 'text-xs text-muted-foreground',
        children: ['The surface below fits its content, so it has nothing to scroll.'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-scroll-area-root',
        className: 'relative h-24 w-full overflow-hidden rounded border',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-scroll-area-viewport',
            className: 'h-full w-full overflow-auto',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-2 p-3 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Fits its viewport'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded bg-gray-50 px-2 py-1',
                    children: ['Second row'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
