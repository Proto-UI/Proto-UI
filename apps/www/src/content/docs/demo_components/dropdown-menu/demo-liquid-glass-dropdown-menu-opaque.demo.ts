export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-trigger',
            props: { material: 'opaque' },
            children: ['Opaque Surface'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-content',
            props: { align: 'start', material: 'opaque' },
            surfaceStyle: 'w-44',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-group',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-label',
                    children: ['Solid fallback'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-item',
                    props: { value: 'inspect', textValue: 'Inspect' },
                    children: ['Inspect'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-item',
                    props: { value: 'export', textValue: 'Export' },
                    children: ['Export'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-trigger',
            props: { disabled: true },
            children: ['Unavailable'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-item',
                props: { value: 'locked', textValue: 'Locked' },
                children: ['Locked'],
              },
            ],
          },
        ],
      },
    ],
  },
};
