export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-async-region-root',
        props: { busy: true },
        className:
          'flex items-center justify-between gap-4 rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background)] px-4 py-3 text-sm font-medium text-[var(--pui-foreground)] shadow-[4px_4px_0_0_#000]',
        children: [
          {
            kind: 'box',
            className: 'flex items-center gap-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-spinner-root',
                props: { size: 'sm' },
              },
              'Processing payment…',
            ],
          },
          {
            kind: 'box',
            className: 'text-xs font-bold',
            children: ['$100.00'],
          },
        ],
      },
    ],
  },
};
