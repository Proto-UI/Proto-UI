export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-hover-card-root',
    props: { openDelay: 150, closeDelay: 200 },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-trigger',
        children: ['@proto-ui'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-hover-card-content',
        props: { side: 'bottom', align: 'center' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1',
            children: [
              {
                kind: 'box',
                className: 'font-heading text-sm font-bold',
                children: ['@proto-ui'],
              },
              {
                kind: 'box',
                className: 'text-sm',
                children: [
                  'Host-neutral interaction protocols with bold Neo-Brutalist borders and hard shadows.',
                ],
              },
              {
                kind: 'box',
                className: 'pt-1 text-xs text-muted-foreground',
                children: ['Joined December 2024'],
              },
            ],
          },
        ],
      },
    ],
  },
};
