export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tooltip-group',
    className: 'flex flex-col items-center gap-5',
    props: { openDelay: 500, closeDelay: 150, skipDelay: 700 },
    children: [
      {
        kind: 'box',
        className: 'text-center text-sm text-muted-foreground',
        children: [
          'Hover the first trigger for 500ms, then cross to its sibling during the warm window.',
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-6 py-8',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-tooltip-trigger',
                ref: 'accountTrigger',
                className:
                  'rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm',
                children: ['Account'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tooltip-content',
                ref: 'accountContent',
                props: { side: 'top', align: 'center', sideOffset: 8 },
                children: ['Open account settings.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tooltip-root',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-tooltip-trigger',
                ref: 'notificationsTrigger',
                className:
                  'rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm',
                children: ['Notifications'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-tooltip-content',
                ref: 'notificationsContent',
                props: { side: 'top', align: 'center', sideOffset: 8 },
                children: ['Review recent notifications.'],
              },
            ],
          },
        ],
      },
    ],
  },
};
