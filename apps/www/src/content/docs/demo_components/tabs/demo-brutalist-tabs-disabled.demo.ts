export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-tabs-root',
    className: 'w-[420px] max-w-full',
    props: { defaultValue: 'home' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-list',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'home' },
            children: ['Home'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tabs-trigger',
            props: { value: 'settings', disabled: true },
            children: ['Disabled'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'home' },
        children: [
          'Disabled tabs remain visible in the strip while skipping focus and pointer activation.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-tabs-content',
        props: { value: 'settings' },
        children: ['Administrator settings are currently locked.'],
      },
    ],
  },
};
