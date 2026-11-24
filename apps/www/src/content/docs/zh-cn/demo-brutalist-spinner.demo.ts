export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            ref: 'spinner-sm',
            props: { size: 'sm' },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            ref: 'spinner-md',
            props: { size: 'md' },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            ref: 'spinner-lg',
            props: { size: 'lg' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-async-region-root',
        ref: 'busy-region',
        props: { busy: true },
        className:
          'flex items-center gap-3 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-3.5 py-2.5 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            ref: 'spinner-busy',
          },
          'Loading results…',
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            ref: 'saving-button',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-spinner-root',
                ref: 'spinner-action',
                props: { size: 'sm' },
              },
              'Saving…',
            ],
          },
        ],
      },
    ],
  },
};
