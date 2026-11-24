import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const ITEMS = [
  { group: 'Navigation', value: 'home', label: 'Home', shortcut: '⌘H' },
  { group: 'Navigation', value: 'inbox', label: 'Inbox', shortcut: '⌘I' },
  { group: 'Navigation', value: 'documents', label: 'Documents', shortcut: '⌘D' },
  { group: 'Navigation', value: 'folders', label: 'Folders', shortcut: '⌘F' },
  { group: 'Actions', value: 'new-file', label: 'New File', shortcut: '⌘N' },
  { group: 'Actions', value: 'new-folder', label: 'New Folder', shortcut: '⇧⌘N' },
  { group: 'Actions', value: 'copy', label: 'Copy', shortcut: '⌘C' },
  { group: 'Actions', value: 'cut', label: 'Cut', shortcut: '⌘X' },
  { group: 'Actions', value: 'paste', label: 'Paste', shortcut: '⌘V' },
  { group: 'Actions', value: 'delete', label: 'Delete', shortcut: '⌫' },
  { group: 'View', value: 'grid-view', label: 'Grid View', shortcut: '' },
  { group: 'View', value: 'list-view', label: 'List View', shortcut: '' },
  { group: 'View', value: 'zoom-in', label: 'Zoom In', shortcut: '⌘+' },
  { group: 'View', value: 'zoom-out', label: 'Zoom Out', shortcut: '⌘-' },
  { group: 'Tools', value: 'calculator', label: 'Calculator', shortcut: '' },
  { group: 'Tools', value: 'calendar', label: 'Calendar', shortcut: '' },
  { group: 'Tools', value: 'code-editor', label: 'Code Editor', shortcut: '' },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-command-root',
            ref: 'root',
            props: { a11yLabel: 'Scrollable command menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-command-input',
                props: {
                  placeholder: 'Type a command or search...',
                  a11yLabel: 'Search commands',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-command-content',
                children: [
                  ...ITEMS.map((item) => ({
                    kind: 'proto' as const,
                    prototypeId: 'brutalist-command-item',
                    props: {
                      value: item.value,
                      textValue: item.label,
                      keywords: item.group.toLowerCase(),
                    },
                    children: item.shortcut
                      ? [
                          { kind: 'box' as const, tag: 'span' as const, children: [item.label] },
                          {
                            kind: 'box' as const,
                            tag: 'span' as const,
                            className: 'ml-auto font-mono text-xs tracking-widest opacity-80',
                            children: [item.shortcut],
                          },
                        ]
                      : [item.label],
                  })),
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-empty',
                    children: ['No results found.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs font-medium text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Scroll or use Arrow keys to browse 17 commands.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onExecute: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = `Last command: ${detail.textValue}`;
      },
    });
  },
} satisfies DemoSpec;
