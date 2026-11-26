import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-command-root',
            ref: 'root',
            props: { a11yLabel: 'Settings shortcuts' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-command-input',
                props: {
                  placeholder: 'Search settings or keywords...',
                  a11yLabel: 'Search settings',
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
                    children: ['Settings'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-item',
                    props: { value: 'profile', textValue: 'Profile', keywords: 'account user' },
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
                    props: { value: 'billing', textValue: 'Billing', keywords: 'invoice payment' },
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
                      keywords: 'preferences config',
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
                    prototypeId: 'liquid-glass-command-item',
                    props: {
                      value: 'shortcuts',
                      textValue: 'Keyboard Shortcuts',
                      keywords: 'hotkeys keybindings',
                    },
                    children: [
                      { kind: 'box', tag: 'span', children: ['Keyboard Shortcuts'] },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'ml-auto font-mono text-xs tracking-widest opacity-75',
                        children: ['⌘K'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-empty',
                    children: ['No matching shortcuts.'],
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
        children: ['Concentric rounded-xl items nested inside a rounded-2xl container.'],
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
