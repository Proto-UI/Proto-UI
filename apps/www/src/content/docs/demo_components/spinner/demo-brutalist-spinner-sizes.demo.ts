export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-end gap-6',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'sm' },
          },
          {
            kind: 'box',
            className: 'text-xs font-medium text-[var(--pui-muted-foreground)]',
            children: ['sm (16px)'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'md' },
          },
          {
            kind: 'box',
            className: 'text-xs font-medium text-[var(--pui-muted-foreground)]',
            children: ['md (24px)'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'lg' },
          },
          {
            kind: 'box',
            className: 'text-xs font-medium text-[var(--pui-muted-foreground)]',
            children: ['lg (32px)'],
          },
        ],
      },
    ],
  },
};
