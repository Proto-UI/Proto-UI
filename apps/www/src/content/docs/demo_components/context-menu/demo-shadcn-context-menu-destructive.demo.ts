import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-context-menu-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-context-menu-trigger',
            className:
              'flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground',
            children: ['Right click here'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-context-menu-content',
            className: 'w-48',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'edit', textValue: 'Edit', inset: true },
                children: ['Edit'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'duplicate', textValue: 'Duplicate', inset: true },
                children: ['Duplicate'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'share', textValue: 'Share', inset: true },
                children: ['Share'],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-px bg-border/50',
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive', inset: true },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
