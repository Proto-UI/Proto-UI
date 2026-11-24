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
            className: 'w-48',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'edit', textValue: 'Edit', inset: true },
                children: ['Edit'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'share', textValue: 'Share', inset: true },
                children: ['Share'],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-0.5 bg-black',
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-context-menu-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive', inset: true },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
