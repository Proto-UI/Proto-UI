export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-root',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tooltip-trigger',
            ref: 'brutalistDisabledTrigger',
            className: 'inline-block w-fit',
            children: [
              {
                kind: 'box',
                tag: 'span',
                attrs: { 'aria-disabled': 'true' },
                className:
                  'inline-flex items-center justify-center rounded-base border-2 border-foreground bg-secondary-background px-4 py-2 font-sans text-sm font-medium text-foreground opacity-50 cursor-not-allowed',
                children: ['Disabled'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tooltip-content',
            ref: 'brutalistDisabledContent',
            props: { side: 'top', align: 'center' },
            children: ['This feature is currently unavailable'],
          },
        ],
      },
    ],
  },
};
