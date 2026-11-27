export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-root',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-tooltip-trigger',
            ref: 'brutalistShortcutTrigger',
            className:
              'inline-flex items-center justify-center rounded-base border-2 border-foreground bg-main px-4 py-2 font-sans text-sm font-medium text-main-foreground cursor-pointer',
            children: ['Save'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-tooltip-content',
            ref: 'brutalistShortcutContent',
            previewTheme: 'portal',
            props: { side: 'top', align: 'center' },
            children: [
              'Save Changes',
              {
                kind: 'box',
                tag: 'span',
                className:
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-foreground bg-background px-1 font-mono text-xs leading-none text-foreground',
                children: ['S'],
              },
            ],
          },
        ],
      },
    ],
  },
};
