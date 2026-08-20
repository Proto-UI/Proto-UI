export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-tabs-root',
    className: 'w-full max-w-sm',
    props: { defaultValue: 'overview' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'overview' },
            children: ['Overview'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'details' },
            children: ['Details'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'overview' },
        children: ['Hard borders, loud yellow, no radius.'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'details' },
        children: ['Dark mode keeps black shadows on warm paper.'],
      },
    ],
  },
};
