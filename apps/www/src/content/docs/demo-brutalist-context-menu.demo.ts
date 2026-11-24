import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-context-menu-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-context-menu-trigger',
            className:
              'flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground',
            children: ['Right click here'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-context-menu-content',
            className: 'w-56',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'back', textValue: 'Back' },
                children: [
                  'Back',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    children: ['⌘['],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'forward', textValue: 'Forward', disabled: true },
                children: [
                  'Forward',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    children: ['⌘]'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'reload', textValue: 'Reload' },
                children: [
                  'Reload',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    children: ['⌘R'],
                  },
                ],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-0.5 bg-black',
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'save-page', textValue: 'Save Page As' },
                children: [
                  'Save Page As...',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest opacity-70',
                    children: ['⇧⌘S'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'devtools', textValue: 'Developer Tools' },
                children: ['Developer Tools'],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-0.5 bg-black',
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
                children: [
                  'Delete',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest',
                    children: ['⌫'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
