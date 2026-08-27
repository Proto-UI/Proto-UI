export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-checkbox-root',
            props: { defaultChecked: false },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-checkbox-indicator',
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Unchecked'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-checkbox-root',
            props: { defaultChecked: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-checkbox-indicator',
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Checked'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-checkbox-root',
            props: { defaultIndeterminate: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-checkbox-indicator',
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Mixed'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-checkbox-root',
            props: { disabled: true, defaultChecked: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-checkbox-indicator',
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Disabled'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-checkbox-root',
            props: { defaultChecked: false },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-checkbox-indicator',
              },
            ],
          },
          {
            kind: 'box',
            className: 'text-sm',
            children: ['Tab here for the focus ring'],
          },
        ],
      },
    ],
  },
};
