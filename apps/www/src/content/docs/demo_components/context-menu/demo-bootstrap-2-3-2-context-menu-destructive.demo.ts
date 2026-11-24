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
                props: { value: 'edit', textValue: 'Edit' },
                children: ['Edit'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-context-menu-item',
                props: { value: 'share', textValue: 'Share' },
                children: ['Share'],
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
