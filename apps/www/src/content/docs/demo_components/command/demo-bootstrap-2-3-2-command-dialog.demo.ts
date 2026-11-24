import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full flex-col items-center justify-center gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dialog-root',
        ref: 'dialog',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-trigger',
            children: ['Open Menu'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-content',
            ref: 'dialogContent',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-title',
                children: ['Command Palette'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-description',
                children: ['Filter actions and press Enter to execute.'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-command-root',
                ref: 'root',
                props: { a11yLabel: 'Command menu' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-command-input',
                    props: {
                      placeholder: 'Type a command or search...',
                      a11yLabel: 'Type a command or search',
                    },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-command-content',
                    children: [
                      {
                        kind: 'box',
                        className: 'px-[14px] py-[3px] text-[11px] font-bold uppercase tracking-wide text-[#999]',
                        attrs: { 'aria-hidden': 'true' },
                        children: ['Suggestions'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-command-item',
                        props: { value: 'calendar', textValue: 'Calendar' },
                        children: ['Calendar'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-command-item',
                        props: { value: 'search-emoji', textValue: 'Search Emoji' },
                        children: ['Search Emoji'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-command-item',
                        props: { value: 'calculator', textValue: 'Calculator' },
                        children: ['Calculator'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-command-empty',
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
        className: 'text-xs text-[#666]',
        attrs: { 'aria-live': 'polite' },
        children: ['Click Open Menu to launch the command palette inside a classic modal.'],
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
