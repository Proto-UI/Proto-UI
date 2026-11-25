import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 w-full items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-context-menu-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-context-menu-trigger',
            className: 'h-36 w-72 border-dashed bg-secondary/70',
            children: ['Right click here'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-context-menu-content',
            className: 'w-48',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'edit', textValue: 'Edit', inset: true },
                children: ['Edit'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'share', textValue: 'Share', inset: true },
                children: ['Share'],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: 'mx-2 my-1 h-px bg-border/60',
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: {
                  value: 'delete',
                  textValue: 'Delete',
                  variant: 'destructive',
                  inset: true,
                },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
