export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dropdown-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-dropdown-trigger',
        children: ['Edit'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-dropdown-content',
        props: { align: 'start' },
        surfaceStyle: 'w-44',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-group',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-label',
                children: ['Clipboard'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-copy-icon', props: { size: 16 } },
                  'Copy',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'cut', textValue: 'Cut' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-scissors-icon', props: { size: 16 } },
                  'Cut',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'paste', textValue: 'Paste', inset: true },
                children: ['Paste'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-group',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-label',
                props: { inset: true },
                children: ['More actions'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'rename', textValue: 'Rename', inset: true },
                children: ['Rename'],
              },
            ],
          },
        ],
      },
    ],
  },
};
