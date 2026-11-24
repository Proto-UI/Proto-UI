export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-dropdown-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dropdown-trigger',
        children: ['Actions'],
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
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'edit', textValue: 'Edit' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-pencil-icon', props: { size: 14 } },
                  'Edit',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'share', textValue: 'Share' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-share-icon', props: { size: 14 } },
                  'Share',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'archive', textValue: 'Archive', disabled: true },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-archive-icon', props: { size: 14 } },
                  'Archive',
                ],
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
                prototypeId: 'bootstrap-2-3-2-dropdown-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-trash-icon', props: { size: 14 } },
                  'Delete',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
