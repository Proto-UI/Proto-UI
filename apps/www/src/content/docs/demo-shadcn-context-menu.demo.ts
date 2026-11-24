import { withShadcnRheaDemo } from './shadcn-demo-style';
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
            className: 'w-52',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'back', textValue: 'Back' },
                children: [
                  'Back',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘['],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'forward', textValue: 'Forward', disabled: true },
                children: [
                  'Forward',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘]'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'reload', textValue: 'Reload' },
                children: [
                  'Reload',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘R'],
                  },
                ],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-px bg-border/50',
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'save-page', textValue: 'Save Page' },
                children: [
                  'Save Page...',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘S'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'create-shortcut', textValue: 'Create Shortcut' },
                children: ['Create Shortcut...'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'devtools', textValue: 'Developer Tools' },
                children: ['Developer Tools'],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-px bg-border/50',
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
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
} satisfies DemoSpec);
