import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-dialog-root',
        ref: 'dialog',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dialog-trigger',
            children: ['Open Menu'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-command-dialog-content',
            ref: 'dialogContent',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-dialog-title',
                className: 'sr-only',
                children: ['Command Palette'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-dialog-description',
                className: 'sr-only',
                children: ['Search for a command to run.'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-command-root',
                ref: 'root',
                props: { a11yLabel: 'Command menu' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-command-input',
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
                        props: { value: 'calendar', textValue: 'Calendar' },
                        children: ['Calendar'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-command-item',
                        props: { value: 'search-emoji', textValue: 'Search Emoji' },
                        children: ['Search Emoji'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-command-item',
                        props: { value: 'calculator', textValue: 'Calculator' },
                        children: ['Calculator'],
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
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs font-medium text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Click Open Menu to launch the Brutalist command dialog.'],
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
