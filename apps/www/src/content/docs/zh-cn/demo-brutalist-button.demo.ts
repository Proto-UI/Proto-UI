export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-button', children: ['Solid main'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'solid', color: 'mint' },
        children: ['Mint'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'solid', color: 'lavender' },
        children: ['Lavender'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'solid', color: 'coral' },
        children: ['Coral'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'solid', color: 'sky' },
        children: ['Sky'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'surface' },
        children: ['Surface'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'destructive' },
        children: ['Destructive'],
      },
      { kind: 'proto', prototypeId: 'brutalist-button', props: { size: 'icon' }, children: ['!'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { disabled: true, variant: 'surface' },
        children: ['Disabled surface'],
      },
    ],
  },
};
