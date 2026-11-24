import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-command-root',
            ref: 'root',
            props: {
              a11yLabel: 'Command menu',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-command-input',
                ref: 'input',
                props: {
                  placeholder: 'Type a command or search...',
                  a11yLabel: 'Type a command or search',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-command-content',
                children: [
                  {
                    kind: 'box',
                    className: 'px-3 py-1.5 text-xs font-medium text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Suggestions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'calendar',
                      textValue: 'Calendar',
                      keywords: 'date schedule events',
                    },
                    children: ['Calendar'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'search-emoji',
                      textValue: 'Search Emoji',
                      keywords: 'smile icons reactions',
                    },
                    children: ['Search Emoji'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'calculator',
                      textValue: 'Calculator',
                      keywords: 'math numbers',
                      disabled: true,
                    },
                    children: ['Calculator'],
                  },
                  {
                    kind: 'box',
                    className: 'mx-2 my-1 h-px bg-border',
                    attrs: { role: 'separator' },
                  },
                  {
                    kind: 'box',
                    className: 'px-3 py-1.5 text-xs font-medium text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Settings'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'profile',
                      textValue: 'Profile',
                      keywords: 'user account',
                    },
                    children: [
                      { kind: 'box', tag: 'span', children: ['Profile'] },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-75',
                        children: ['⌘P'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'billing',
                      textValue: 'Billing',
                      keywords: 'card invoice subscription',
                    },
                    children: [
                      { kind: 'box', tag: 'span', children: ['Billing'] },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-75',
                        children: ['⌘B'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'settings',
                      textValue: 'Settings',
                      keywords: 'preferences configuration',
                    },
                    children: [
                      { kind: 'box', tag: 'span', children: ['Settings'] },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-75',
                        children: ['⌘S'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-empty',
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
        children: ['Select a command or press Enter.'],
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
