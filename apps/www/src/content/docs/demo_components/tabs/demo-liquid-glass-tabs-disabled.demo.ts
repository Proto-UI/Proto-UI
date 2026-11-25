export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-[468px]',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-tabs-root',
        className: 'w-full',
        props: { defaultValue: 'home' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-list',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'home' },
                children: ['Home'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-tabs-trigger',
                props: { value: 'settings', disabled: true },
                children: ['Disabled'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'home' },
            children: [
              'Disabled triggers withdraw interaction without dimming opacity, preserving opaque fallback contrast.',
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-tabs-content',
            props: { value: 'settings' },
            children: ['Administrator settings are currently disabled.'],
          },
        ],
      },
    ],
  },
};
