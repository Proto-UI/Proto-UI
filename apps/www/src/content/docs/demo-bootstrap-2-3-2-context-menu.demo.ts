import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-context-menu-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-context-menu-trigger',
            className:
              'flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground',
            children: ['Right click here'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-context-menu-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'back', textValue: 'Back' },
                children: [
                  'Back',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs opacity-70',
                    children: ['⌘['],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'forward', textValue: 'Forward', disabled: true },
                children: [
                  'Forward',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs opacity-70',
                    children: ['⌘]'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'reload', textValue: 'Reload' },
                children: [
                  'Reload',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs opacity-70',
                    children: ['⌘R'],
                  },
                ],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: 'my-2 h-px bg-border',
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'save-page', textValue: 'Save Page' },
                children: ['Save Page...'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'devtools', textValue: 'Developer Tools' },
                children: ['Developer Tools'],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: 'my-2 h-px bg-border',
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
