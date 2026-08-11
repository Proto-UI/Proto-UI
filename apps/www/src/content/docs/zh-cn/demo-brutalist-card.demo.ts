export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap gap-5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-root',
        className: 'max-w-lg',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-card-header',
            children: ['AI Support — Conversation workspace'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-card-content',
            children: ['Use Card as an explicit panel shell.'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-card-footer',
            children: [
              '12 messages',
              {
                kind: 'proto',
                prototypeId: 'brutalist-button',
                props: { size: 'sm' },
                children: ['Open conversation'],
              },
            ],
          },
        ],
      },
    ],
  },
};
