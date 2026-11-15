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
        props: { disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline', disabled: true },
        children: ['Disabled outline'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'ghost', size: 'icon' },
        children: [
          { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['+'] },
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Add'] },
        ],
      },
    ],
  },
};
