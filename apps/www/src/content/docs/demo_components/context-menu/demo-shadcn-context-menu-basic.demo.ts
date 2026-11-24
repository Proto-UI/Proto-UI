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
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'back', textValue: 'Back' },
                children: ['Back'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'forward', textValue: 'Forward', disabled: true },
                children: ['Forward'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'reload', textValue: 'Reload' },
                children: ['Reload'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
