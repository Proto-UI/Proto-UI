export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-hover-card-root',
    props: { openDelay: 0, closeDelay: 0 },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-trigger',
        children: [
          {
            kind: 'box',
            tag: 'a',
            props: { href: '#hover-card-target', tabIndex: 0, className: 'cursor-pointer' },
            children: ['Hover preview'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-content',
        children: ['A square hard-shadowed preview panel.'],
      },
    ],
  },
};
