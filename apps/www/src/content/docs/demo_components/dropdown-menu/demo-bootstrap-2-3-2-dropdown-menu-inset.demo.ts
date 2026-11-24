export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-dropdown-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dropdown-trigger',
        children: ['Edit'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dropdown-content',
        props: { align: 'start' },
        surfaceStyle: 'w-44',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dropdown-group',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-label',
                children: ['Clipboard'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-copy-icon', props: { size: 14 } },
                  'Copy',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'cut', textValue: 'Cut' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-scissors-icon', props: { size: 14 } },
                  'Cut',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'paste', textValue: 'Paste', inset: true },
                children: ['Paste'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dropdown-separator',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dropdown-group',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-label',
                props: { inset: true },
                children: ['More actions'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
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
