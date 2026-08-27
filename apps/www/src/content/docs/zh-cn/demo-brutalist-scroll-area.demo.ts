export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-80',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-scroll-area-root',
        className: 'h-48 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-2 p-3',
                children: [
                  { kind: 'box', children: ['Scrollable conversation content.'] },
                  {
                    kind: 'box',
                    className: 'w-[520px] whitespace-nowrap',
                    children: ['A row wider than the viewport, so this surface scrolls both ways.'],
                  },
                  { kind: 'box', children: ['Row 2'] },
                  { kind: 'box', children: ['Row 3'] },
                  { kind: 'box', children: ['Row 4'] },
                  { kind: 'box', children: ['Row 5'] },
                  { kind: 'box', children: ['Row 6'] },
                  { kind: 'box', children: ['Row 7'] },
                  { kind: 'box', children: ['Row 8'] },
                  { kind: 'box', children: ['Row 9'] },
                  { kind: 'box', children: ['Row 10'] },
                  { kind: 'box', children: ['Row 11'] },
                  { kind: 'box', children: ['Row 12'] },
                  { kind: 'box', children: ['Row 13'] },
                  { kind: 'box', children: ['Row 14'] },
                  { kind: 'box', children: ['Row 15'] },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-scrollbar',
            ref: 'scrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-scroll-area-thumb',
                ref: 'thumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-scrollbar',
            ref: 'scrollbarHorizontal',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-scroll-area-thumb',
                ref: 'thumbHorizontal',
              },
            ],
          },
        ],
      },
    ],
  },
};
