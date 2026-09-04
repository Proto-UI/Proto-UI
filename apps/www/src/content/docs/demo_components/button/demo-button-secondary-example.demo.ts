export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      { kind: 'proto', prototypeId: 'shadcn-button', children: ['Default'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'secondary' },
        children: ['Secondary'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline' },
        children: ['Outline'],
      },
    ],
  },
};
