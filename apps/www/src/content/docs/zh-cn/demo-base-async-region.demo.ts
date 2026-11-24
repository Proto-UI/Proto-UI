export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-async-region-root',
    className: 'rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground',
    props: { busy: true },
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          { kind: 'box', className: 'text-muted-foreground', children: ['Loading results…'] },
        ],
      },
    ],
  },
};
