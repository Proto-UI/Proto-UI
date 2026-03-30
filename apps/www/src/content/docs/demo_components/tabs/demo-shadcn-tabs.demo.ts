export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'account' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'account' },
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'password' },
            children: ['Password'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-tabs-trigger',
            props: { value: 'billing', disabled: true },
            children: ['Billing'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'account' },
        children: ['Make changes to your account here.'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'password' },
        children: ['Change your password here.'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-tabs-content',
        props: { value: 'billing' },
        children: ['Billing tab is disabled in this preview.'],
      },
    ],
  },
};
