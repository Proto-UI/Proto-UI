export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'sm' },
          },
          'Please wait',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { variant: 'surface', disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'sm' },
          },
          'Saving…',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        props: { color: 'mint' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-spinner-root',
            props: { size: 'sm' },
          },
          'Processing',
        ],
      },
    ],
  },
};
