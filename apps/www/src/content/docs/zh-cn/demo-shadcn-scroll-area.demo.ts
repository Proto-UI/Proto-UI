export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-80',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-scroll-area-root',
        className: 'h-48 w-full border bg-background',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-[520px] flex-col gap-3 p-4 text-sm',
                children: [
                  { kind: 'box', className: 'font-medium', children: ['Release activity'] },
                  {
                    kind: 'box',
                    className: 'whitespace-nowrap text-muted-foreground',
                    children: ['This deliberately wide row proves horizontal host scrolling.'],
                  },
                  { kind: 'box', children: ['01 · Base owns the scroll position.'] },
                  { kind: 'box', children: ['02 · Viewport reports normalized facts.'] },
                  { kind: 'box', children: ['03 · Scrollbar projects orientation.'] },
                  { kind: 'box', children: ['04 · Thumb reflects the visible range.'] },
                  { kind: 'box', children: ['05 · Dragging requests host scrolling.'] },
                  { kind: 'box', children: ['06 · Styling never forks scroll state.'] },
                  { kind: 'box', children: ['07 · Vertical overflow remains host-owned.'] },
                  { kind: 'box', children: ['08 · Horizontal overflow uses the same surface.'] },
                  { kind: 'box', children: ['09 · Keyboard behavior stays host-owned.'] },
                  { kind: 'box', children: ['10 · The shadcn layer supplies chrome only.'] },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};
