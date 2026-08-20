export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-toggle',
        className: 'rounded border px-3 py-2 text-sm font-medium',
        children: ['Pin'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-toggle',
        props: { defaultActive: true },
        className: 'rounded border px-3 py-2 text-sm font-medium',
        children: ['Bold'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-toggle',
        props: { disabled: true, defaultActive: true },
        className: 'rounded border px-3 py-2 text-sm opacity-50',
        children: ['Disabled'],
      },
    ],
  },
};
