import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-root',
        ref: 'dialog',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-trigger',
            children: ['Open Menu'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-command-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
            props: {
              enterDuration: 100,
              leaveDuration: 100,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-command-dialog-content',
            ref: 'dialogContent',
            previewTheme: 'portal',
            props: {
              enterDuration: 100,
              leaveDuration: 100,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-title',
                className: 'sr-only',
                children: ['Command Palette'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-description',
                className: 'sr-only',
                children: ['Search for a command to run.'],
              },
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
                        props: { value: 'calendar', textValue: 'Calendar' },
                        children: ['Calendar'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-command-item',
                        props: { value: 'search-emoji', textValue: 'Search Emoji' },
                        children: ['Search Emoji'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-command-item',
                        props: { value: 'calculator', textValue: 'Calculator' },
                        children: ['Calculator'],
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
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Click Open Menu to launch the command dialog.'],
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
