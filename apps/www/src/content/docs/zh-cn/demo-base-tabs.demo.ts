export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-tabs-root',
    className: 'w-full max-w-md',
    props: { defaultValue: 'account' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-tabs-list',
        className: 'flex gap-1 border-b',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-tabs-trigger',
            props: { value: 'account' },
            className: 'px-3 py-2 text-sm font-medium',
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'base-tabs-trigger',
            props: { value: 'security' },
            className: 'px-3 py-2 text-sm font-medium',
            children: ['Security'],
          },
          {
            kind: 'proto',
            prototypeId: 'base-tabs-trigger',
            props: { value: 'billing', disabled: true },
            className: 'px-3 py-2 text-sm opacity-50',
            children: ['Billing'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-tabs-indicator',
        className: 'block h-0.5 bg-black',
      },
      {
        kind: 'proto',
        prototypeId: 'base-tabs-content',
        props: { value: 'account' },
        className: 'py-4 text-sm',
        children: ['Account settings'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-tabs-content',
        props: { value: 'security' },
        className: 'py-4 text-sm',
        children: ['Security settings'],
      },
      {
        kind: 'proto',
        prototypeId: 'base-tabs-content',
        props: { value: 'billing' },
        className: 'py-4 text-sm',
        children: ['Billing is disabled in this preview.'],
      },
    ],
  },
};
