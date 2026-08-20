export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-button',
        className: 'rounded border px-3 py-2 text-sm font-medium',
        children: ['Run action'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-button',
        props: { disabled: true },
        className: 'rounded border px-3 py-2 text-sm opacity-50',
        children: ['Disabled'],
      },
    ],
  },
};
