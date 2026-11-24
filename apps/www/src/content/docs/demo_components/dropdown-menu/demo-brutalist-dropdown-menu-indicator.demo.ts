export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-trigger',
            props: {
              indicator: true,
              indicatorIcon: 'chevron-down',
            },
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-content',
            props: { align: 'end' },
            surfaceStyle: 'w-40',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'duplicate', textValue: 'Duplicate' },
                children: ['Duplicate'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'export', textValue: 'Export' },
                children: ['Export'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-separator',
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
      {
        kind: 'proto',
        prototypeId: 'brutalist-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-trigger',
            props: {
              indicator: true,
              indicatorIcon: 'chevrons-up-down',
            },
            children: ['Workspace'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dropdown-content',
            props: { align: 'start' },
            surfaceStyle: 'w-40',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-label',
                children: ['Switch workspace'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'personal', textValue: 'Personal' },
                children: ['Personal'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dropdown-item',
                props: { value: 'studio', textValue: 'Design Studio' },
                children: ['Design Studio'],
              },
            ],
          },
        ],
      },
    ],
  },
};
