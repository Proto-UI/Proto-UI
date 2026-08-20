export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-toggle', children: ['Toggle'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { defaultActive: true },
        children: ['Active'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { size: 'lg' },
        children: ['Large'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle',
        props: { disabled: true },
        children: ['Disabled'],
      },
    ],
  },
};
