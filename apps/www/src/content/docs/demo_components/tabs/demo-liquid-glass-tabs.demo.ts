export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'liquid-glass-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'account' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-trigger',
            props: { value: 'account' },
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-trigger',
            props: { value: 'password' },
            children: ['Password'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-trigger',
            props: { value: 'billing', disabled: true },
            children: ['Billing'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-content',
        props: { value: 'account' },
        children: ['Make changes to your account here.'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-content',
        props: { value: 'password' },
        children: ['Change your password here.'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-content',
        props: { value: 'billing' },
        children: ['Billing tab is disabled in this preview.'],
      },
    ],
  },
};
