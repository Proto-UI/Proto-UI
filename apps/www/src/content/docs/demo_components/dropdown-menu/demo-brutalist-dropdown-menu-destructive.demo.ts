export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-dropdown-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-dropdown-trigger',
        children: ['Actions'],
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
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'edit', textValue: 'Edit' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-pencil-icon', props: { size: 16 } },
                  'Edit',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'share', textValue: 'Share' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-share-icon', props: { size: 16 } },
                  'Share',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'archive', textValue: 'Archive' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-archive-icon', props: { size: 16 } },
                  'Archive',
                ],
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
                prototypeId: 'brutalist-dropdown-item',
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
};
