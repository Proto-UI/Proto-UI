import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoChild, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const COMMAND_GROUPS = [
  {
    heading: 'Navigation',
    items: [
      { value: 'home', label: 'Home', shortcut: '⌘H', keywords: 'dashboard start' },
      { value: 'inbox', label: 'Inbox', shortcut: '⌘I', keywords: 'messages mail' },
      { value: 'documents', label: 'Documents', shortcut: '⌘D', keywords: 'files docs' },
      { value: 'folders', label: 'Folders', shortcut: '⌘F', keywords: 'directories' },
    ],
  },
  {
    heading: 'Actions',
    items: [
      { value: 'new-file', label: 'New File', shortcut: '⌘N', keywords: 'create' },
      { value: 'new-folder', label: 'New Folder', shortcut: '⇧⌘N', keywords: 'directory' },
      { value: 'copy', label: 'Copy', shortcut: '⌘C', keywords: 'clipboard duplicate' },
      { value: 'cut', label: 'Cut', shortcut: '⌘X', keywords: 'clipboard move' },
      { value: 'paste', label: 'Paste', shortcut: '⌘V', keywords: 'clipboard insert' },
      { value: 'delete', label: 'Delete', shortcut: '⌫', keywords: 'remove trash' },
    ],
  },
  {
    heading: 'View',
    items: [
      { value: 'grid-view', label: 'Grid View', shortcut: '', keywords: 'layout cards' },
      { value: 'list-view', label: 'List View', shortcut: '', keywords: 'layout rows' },
      { value: 'zoom-in', label: 'Zoom In', shortcut: '⌘+', keywords: 'magnify scale' },
      { value: 'zoom-out', label: 'Zoom Out', shortcut: '⌘-', keywords: 'shrink scale' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { value: 'profile', label: 'Profile', shortcut: '⌘P', keywords: 'user' },
      { value: 'billing', label: 'Billing', shortcut: '⌘B', keywords: 'payment' },
      { value: 'settings', label: 'Settings', shortcut: '⌘S', keywords: 'preferences' },
      { value: 'notifications', label: 'Notifications', shortcut: '', keywords: 'alerts' },
      { value: 'help', label: 'Help & Support', shortcut: '', keywords: 'docs faq' },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { value: 'calculator', label: 'Calculator', shortcut: '', keywords: 'math' },
      { value: 'calendar', label: 'Calendar', shortcut: '', keywords: 'schedule' },
      { value: 'image-editor', label: 'Image Editor', shortcut: '', keywords: 'photo' },
      { value: 'code-editor', label: 'Code Editor', shortcut: '', keywords: 'developer' },
    ],
  },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-command-root',
            ref: 'root',
            props: { a11yLabel: 'Scrollable command menu' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-input-wrapper',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-input-shell',
                    props: { focusIndicator: 'none' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-command-input',
                        props: {
                          placeholder: 'Type a command or search...',
                          a11yLabel: 'Search all 23 commands',
                        },
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-content',
                children: [
                  ...COMMAND_GROUPS.flatMap<DemoChild>((group, index) => [
                    ...(index > 0
                      ? [
                          {
                            kind: 'box' as const,
                            className: 'my-1 h-px bg-border',
                            attrs: { role: 'separator' },
                          } satisfies DemoChild,
                        ]
                      : []),
                    {
                      kind: 'box' as const,
                      className: 'px-2 py-1.5 text-xs font-medium text-muted-foreground',
                      attrs: { 'aria-hidden': 'true' },
                      children: [group.heading],
                    } satisfies DemoChild,
                    ...group.items.map<DemoChild>((item) => ({
                      kind: 'proto' as const,
                      prototypeId: 'shadcn-command-item',
                      props: {
                        value: item.value,
                        textValue: item.label,
                        keywords: item.keywords,
                      },
                      children: item.shortcut
                        ? [
                            { kind: 'box' as const, tag: 'span' as const, children: [item.label] },
                            {
                              kind: 'box' as const,
                              tag: 'span' as const,
                              className:
                                'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                              children: [item.shortcut],
                            },
                          ]
                        : [item.label],
                    })),
                  ]),
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-empty',
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
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['23 commands across 5 groups inside a bounded scrollable list.'],
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
} satisfies DemoSpec);
