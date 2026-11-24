import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
            props: {
              a11yLabel: 'Command menu',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-command-input',
                ref: 'input',
                props: {
                  placeholder: 'Type a command or search...',
                  a11yLabel: 'Type a command or search',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-command-content',
                children: [
                  {
                    kind: 'box',
                    className: 'px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wide text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Suggestions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-item',
                    props: {
                      value: 'calendar',
                      textValue: 'Calendar',
                      keywords: 'date schedule events',
                    },
                    children: ['Calendar'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-item',
                    props: {
                      value: 'search-emoji',
                      textValue: 'Search Emoji',
                      keywords: 'smile icons reactions',
                    },
                    children: ['Search Emoji'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-item',
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
                    className: 'my-1 h-0.5 bg-border',
                    attrs: { role: 'separator' },
                  },
                  {
                    kind: 'box',
                    className: 'px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wide text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Settings'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-80',
                        children: ['⌘P'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-80',
                        children: ['⌘B'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-80',
                        children: ['⌘S'],
                      },
                    ],
                  },
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
