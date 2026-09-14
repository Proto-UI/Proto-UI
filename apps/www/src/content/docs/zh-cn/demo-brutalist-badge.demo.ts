export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'accent', variant: 'outline' },
        children: ['Accent'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'info' },
        children: ['Info'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-badge-root',
        props: { tone: 'danger' },
        children: ['Danger'],
      },
    ],
  },
};
