export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-5',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Email'] },
          {
            kind: 'proto',
            prototypeId: 'brutalist-input-root',
            props: {
              defaultValue: 'alex@example.com',
              placeholder: 'Email',
              inputMode: 'email',
              ariaLabel: 'Email',
            },
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['We will send account notifications to this address.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Disabled'] },
          {
            kind: 'proto',
            prototypeId: 'brutalist-input-root',
            props: {
              defaultValue: 'Disabled field',
              disabled: true,
              ariaLabel: 'Disabled example',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Read only'] },
          {
            kind: 'proto',
            prototypeId: 'brutalist-input-root',
            props: {
              defaultValue: 'https://app.example.com/acme',
              readOnly: true,
              inputMode: 'url',
              ariaLabel: 'Read-only example',
            },
          },
        ],
      },
    ],
  },
};
