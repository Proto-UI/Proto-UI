export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-async-region-root',
    className: 'rounded-md border bg-white px-4 py-3 text-sm',
    props: { busy: true },
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [{ kind: 'box', className: 'text-slate-400', children: ['Loading results…'] }],
      },
    ],
  },
};
