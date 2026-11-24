export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 flex-wrap items-center justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-trigger',
            children: ['Actions'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-content',
            props: { align: 'start' },
            surfaceStyle: 'w-48',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-group',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-label',
                    children: ['Document'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-item',
                    props: { value: 'copy', textValue: 'Copy' },
                    children: [
                      { kind: 'proto', prototypeId: 'lucide-copy-icon', props: { size: 16 } },
                      'Copy',
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-item',
                    props: { value: 'share', textValue: 'Share' },
                    children: [
                      { kind: 'proto', prototypeId: 'lucide-share-icon', props: { size: 16 } },
                      'Share',
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-item',
                    props: { value: 'rename', textValue: 'Rename', inset: true },
                    children: ['Rename'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-separator',
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-group',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dropdown-item',
                    props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
                    children: [
                      { kind: 'proto', prototypeId: 'lucide-trash-icon', props: { size: 16 } },
                      'Delete',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
