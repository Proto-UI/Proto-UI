import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
            props: {
              a11yLabel: 'Command menu',
            },
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
                        ref: 'input',
                        props: {
                          placeholder: 'Type a command or search...',
                          a11yLabel: 'Type a command or search',
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
                  {
                    kind: 'box',
                    className: 'px-2 py-1.5 text-xs font-medium text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Suggestions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: {
                      value: 'calendar',
                      textValue: 'Calendar',
                      keywords: 'date schedule events',
                    },
                    children: ['Calendar'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: {
                      value: 'search-emoji',
                      textValue: 'Search Emoji',
                      keywords: 'smile icons reactions',
                    },
                    children: ['Search Emoji'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
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
                    className: 'my-1 h-px bg-border',
                    attrs: { role: 'separator' },
                  },
                  {
                    kind: 'box',
                    className: 'px-2 py-1.5 text-xs font-medium text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['Settings'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                        children: ['⌘P'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                        children: ['⌘B'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                        children: ['⌘S'],
                      },
                    ],
                  },
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
} satisfies DemoSpec);
