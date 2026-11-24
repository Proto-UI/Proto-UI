export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-[496px] rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-root',
        className: 'w-full',
        props: { defaultValue: 'account', orientation: 'vertical' },
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
                props: { value: 'notifications' },
                children: ['Notifications'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'account' },
            children: [
              {
                kind: 'box',
                className:
                  'rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-foreground',
                children: [
                  'Vertical track uses concentric rounded-2xl (16px) with p-1 (4px) and rounded-xl (12px) triggers.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'password' },
            children: [
              {
                kind: 'box',
                className:
                  'rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-foreground',
                children: ['Manage password policy, passkeys, and trusted devices.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'notifications' },
            children: [
              {
                kind: 'box',
                className:
                  'rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-foreground',
                children: ['Configure quiet hours and priority alerts.'],
              },
            ],
          },
        ],
      },
    ],
  },
};
