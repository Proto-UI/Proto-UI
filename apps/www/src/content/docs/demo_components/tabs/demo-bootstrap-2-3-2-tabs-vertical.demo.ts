export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-tabs-root',
    className: 'w-[460px] max-w-full',
    props: { defaultValue: 'account', orientation: 'vertical' },
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
            props: { value: 'notifications' },
            children: ['Notifications'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'account' },
        children: [
          'Classic Bootstrap 2.3.2 left-aligned tabs (.tabs-left) with left-rounded active borders.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'password' },
        children: ['Update your credentials and configure session timeout rules.'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tabs-content',
        props: { value: 'notifications' },
        children: ['Choose digest frequency and alert delivery channels.'],
      },
    ],
  },
};
