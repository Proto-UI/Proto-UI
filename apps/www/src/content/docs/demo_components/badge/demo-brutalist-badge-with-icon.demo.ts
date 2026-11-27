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
          { kind: 'proto', prototypeId: 'lucide-check-icon', props: { size: 12 } },
          'Verified',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'accent' },
        children: [
          { kind: 'proto', prototypeId: 'lucide-star-icon', props: { size: 12 } },
          'Featured',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'danger' },
        children: [
          'Breaking',
          { kind: 'proto', prototypeId: 'lucide-circle-alert-icon', props: { size: 12 } },
        ],
      },
    ],
  },
};
