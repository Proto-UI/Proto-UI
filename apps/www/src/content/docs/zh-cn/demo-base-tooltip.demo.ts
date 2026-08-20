export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-tooltip-group',
    className: 'flex flex-col items-center gap-5',
    props: { openDelay: 500, closeDelay: 150, skipDelay: 700 },
    children: [
      {
        kind: 'box',
        className: 'text-center text-sm text-muted-foreground',
        children: [
          'Hover the first trigger for 500ms, move between triggers to test the warm window, or use Tab for immediate keyboard opening.',
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-8 py-6',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-tooltip-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'base-tooltip-trigger',
                className:
                  'cursor-help rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                children: ['Account'],
              },
              {
                kind: 'proto',
                prototypeId: 'base-tooltip-content',
                className:
                  'max-w-56 rounded-md border bg-foreground px-3 py-2 text-sm text-background shadow-lg',
                props: { side: 'top', align: 'center', sideOffset: 8 },
                children: ['View account settings and profile details.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-tooltip-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'base-tooltip-trigger',
                className:
                  'cursor-help rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                children: ['Notifications'],
              },
              {
                kind: 'proto',
                prototypeId: 'base-tooltip-content',
                className:
                  'max-w-56 rounded-md border bg-foreground px-3 py-2 text-sm text-background shadow-lg',
                props: { side: 'top', align: 'center', sideOffset: 8 },
                children: ['Review recent alerts and notification preferences.'],
              },
            ],
          },
        ],
      },
    ],
  },
};
