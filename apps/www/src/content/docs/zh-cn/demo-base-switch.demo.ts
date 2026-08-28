export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-switch-root',
        props: { defaultChecked: false },
        className: 'inline-flex h-7 w-12 items-center rounded-full border p-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-switch-thumb',
            className: 'block size-5 rounded-full border bg-white',
          },
          { kind: 'box', className: 'sr-only', children: ['Email alerts'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-switch-root',
        props: { defaultChecked: true },
        className: 'inline-flex h-7 w-12 items-center justify-end rounded-full border p-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-switch-thumb',
            className: 'block size-5 rounded-full border bg-white',
          },
          { kind: 'box', className: 'sr-only', children: ['Release alerts'] },
        ],
      },
    ],
  },
};
