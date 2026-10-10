export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'account' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'account' },
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'password' },
            children: ['Password'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tabs-trigger',
            props: { value: 'billing', disabled: true },
            children: ['Billing'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'account' },
        children: ['Make changes to your account here.'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'password' },
        children: ['Change your password here.'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'billing' },
        children: ['Billing tab is disabled in this preview.'],
      },
    ],
  },
};
