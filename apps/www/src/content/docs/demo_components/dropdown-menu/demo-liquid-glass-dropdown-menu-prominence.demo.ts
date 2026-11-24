export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 flex-wrap items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dropdown-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-trigger',
            props: { prominence: 'regular', indicator: true },
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-content',
            props: { align: 'start' },
            surfaceStyle: 'w-40',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-item',
                props: { value: 'duplicate', textValue: 'Duplicate' },
                children: ['Duplicate'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-item',
                props: { value: 'archive', textValue: 'Archive' },
                children: ['Archive'],
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
            props: { prominence: 'prominent', indicator: true },
            children: ['Create New'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dropdown-content',
            props: { align: 'end' },
            surfaceStyle: 'w-44',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-label',
                children: ['New item'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-item',
                props: { value: 'note', textValue: 'Note' },
                children: ['Note'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dropdown-item',
                props: { value: 'folder', textValue: 'Folder' },
                children: ['Folder'],
              },
            ],
          },
        ],
      },
    ],
  },
};
