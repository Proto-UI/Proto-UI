export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-select-root',
    props: { defaultValue: 'paper' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-trigger',
        children: [{ kind: 'proto', prototypeId: 'brutalist-select-value' }],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'paper', textValue: 'Paper' },
            children: ['Paper'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'ink', textValue: 'Ink' },
            children: ['Ink'],
          },
        ],
      },
    ],
  },
};
