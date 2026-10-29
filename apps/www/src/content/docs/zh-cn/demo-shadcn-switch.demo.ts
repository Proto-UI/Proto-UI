export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-switch-root',
        props: { size: 'sm', defaultChecked: false },
        children: [
          { kind: 'proto', prototypeId: 'shadcn-switch-thumb' },
          { kind: 'box', className: 'sr-only', children: ['Small email alerts'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-switch-root',
        props: { size: 'sm', defaultChecked: true },
        children: [
          { kind: 'proto', prototypeId: 'shadcn-switch-thumb' },
          { kind: 'box', className: 'sr-only', children: ['Small release alerts'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-switch-root',
        props: { defaultChecked: false, draggable: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-switch-thumb',
          },
          { kind: 'box', className: 'sr-only', children: ['Email alerts — drag or click'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-switch-root',
        props: { defaultChecked: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-switch-thumb',
          },
          { kind: 'box', className: 'sr-only', children: ['Release alerts'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-switch-root',
        props: { disabled: true, defaultChecked: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-switch-thumb',
          },
          { kind: 'box', className: 'sr-only', children: ['Archived alerts'] },
        ],
      },
    ],
  },
};
