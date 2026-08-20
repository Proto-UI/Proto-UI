export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dropdown-root',
    children: [
      { kind: 'proto', prototypeId: 'brutalist-dropdown-trigger', children: ['Open actions'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-dropdown-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-item',
            props: { value: 'profile', textValue: 'Profile' },
            children: ['Profile'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-item',
            props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
            children: ['Delete'],
          },
        ],
      },
    ],
  },
};
