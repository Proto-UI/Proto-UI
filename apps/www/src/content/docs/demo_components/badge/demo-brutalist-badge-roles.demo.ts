export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-2.5 text-sm',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-4',
        children: [
          { kind: 'box', tag: 'span', className: 'font-medium', children: ['Workspace Role'] },
          {
            kind: 'proto',
            prototypeId: 'brutalist-badge-root',
            props: { tone: 'accent' },
            children: ['Maintainer'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-4',
        children: [
          { kind: 'box', tag: 'span', className: 'font-medium', children: ['Deployment Target'] },
          {
            kind: 'proto',
            prototypeId: 'brutalist-badge-root',
            props: { tone: 'info' },
            children: ['Production'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-between gap-4',
        children: [
          { kind: 'box', tag: 'span', className: 'font-medium', children: ['Legacy API v1'] },
          {
            kind: 'proto',
            prototypeId: 'brutalist-badge-root',
            props: { tone: 'danger' },
            children: ['Sunset'],
          },
        ],
      },
    ],
  },
};
