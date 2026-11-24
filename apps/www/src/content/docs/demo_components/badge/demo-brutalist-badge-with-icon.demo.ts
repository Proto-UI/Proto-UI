export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'info' },
        children: [
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['✓'] },
          'Verified',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'accent' },
        children: [
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['★'] },
          'Featured',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'danger' },
        children: [
          'Breaking',
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['!'] },
        ],
      },
    ],
  },
};
