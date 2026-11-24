import { withShadcnRheaDemo } from '../../shadcn-demo-style';
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
            props: { a11yLabel: 'Settings shortcuts' },
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
                          placeholder: 'Search settings or keywords...',
                          a11yLabel: 'Search settings',
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
                    children: ['Settings'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-item',
                    props: { value: 'profile', textValue: 'Profile', keywords: 'account avatar user' },
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
                    props: { value: 'billing', textValue: 'Billing', keywords: 'invoice payment plan' },
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
                    props: { value: 'settings', textValue: 'Settings', keywords: 'preferences config' },
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
                    prototypeId: 'shadcn-command-item',
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
                        className: 'ml-auto font-mono text-xs tracking-widest text-muted-foreground',
                        children: ['⌘K'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-command-empty',
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
        children: ['Try searching by keyword like "invoice" or "hotkeys".'],
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
