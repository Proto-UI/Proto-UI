export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'account' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-list',
        className: 'grid w-full grid-cols-2',
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
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'account' },
        children: [
          {
            kind: 'box',
            className:
              'rounded-base border-2 border-black bg-secondary-background p-5 shadow-[4px_4px_0_0_#000]',
            children: [
              { kind: 'box', className: 'font-heading text-base font-bold', children: ['Account'] },
              {
                kind: 'box',
                className: 'mt-1 text-sm text-muted-foreground',
                children: ['Make changes to your account profile and username here.'],
              },
              {
                kind: 'box',
                className: 'mt-4 grid gap-2 text-sm',
                children: [
                  { kind: 'box', className: 'font-bold', children: ['Name: Pedro Duarte'] },
                  { kind: 'box', children: ['Username: @peduarte'] },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'password' },
        children: [
          {
            kind: 'box',
            className:
              'rounded-base border-2 border-black bg-secondary-background p-5 shadow-[4px_4px_0_0_#000]',
            children: [
              {
                kind: 'box',
                className: 'font-heading text-base font-bold',
                children: ['Password'],
              },
              {
                kind: 'box',
                className: 'mt-1 text-sm text-muted-foreground',
                children: ["Change your password here. After saving, you'll be logged out."],
              },
              {
                kind: 'box',
                className: 'mt-4 text-sm',
                children: [
                  'Use at least 12 characters with a mix of letters, numbers, and symbols.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
