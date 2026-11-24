export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-tabs-root',
    className: 'w-[460px] max-w-full',
    props: { defaultValue: 'account', orientation: 'vertical' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'account' },
            children: ['Account'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'password' },
            children: ['Password'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'notifications' },
            children: ['Notifications'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'account' },
        children: ['Manage profile details, email aliases, and workspace identity.'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'password' },
        children: ['Update your account password and review active login sessions.'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'notifications' },
        children: ['Configure release digests, security alerts, and mention notifications.'],
      },
    ],
  },
};
