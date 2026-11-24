import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dialog-root',
        ref: 'dialog',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-trigger',
            children: ['Open Menu'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-content',
            ref: 'dialogContent',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dialog-title',
                children: ['Command Palette'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-dialog-description',
                children: ['Floating Liquid Glass sheet with an ordinary inner command list.'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-command-root',
                ref: 'root',
                props: { a11yLabel: 'Command menu' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-command-input',
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
                        props: { value: 'calendar', textValue: 'Calendar' },
                        children: ['Calendar'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-command-item',
                        props: { value: 'search-emoji', textValue: 'Search Emoji' },
                        children: ['Search Emoji'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-command-item',
                        props: { value: 'calculator', textValue: 'Calculator' },
                        children: ['Calculator'],
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
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Click Open Menu to launch the floating Liquid Glass command dialog.'],
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
