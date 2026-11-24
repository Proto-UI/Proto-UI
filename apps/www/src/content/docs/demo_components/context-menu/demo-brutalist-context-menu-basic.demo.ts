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
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'back', textValue: 'Back' },
                children: ['Back'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'forward', textValue: 'Forward', disabled: true },
                children: ['Forward'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'reload', textValue: 'Reload' },
                children: ['Reload'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
