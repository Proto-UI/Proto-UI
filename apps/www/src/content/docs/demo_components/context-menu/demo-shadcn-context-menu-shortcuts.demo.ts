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
            className: 'w-52',
            children: [
              {
                kind: 'box',
                className: 'px-2 py-1 text-xs font-medium text-muted-foreground',
                children: ['File'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'new-file', textValue: 'New File' },
                children: [
                  'New File',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘N'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'open-file', textValue: 'Open File' },
                children: [
                  'Open File',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘O'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'save', textValue: 'Save' },
                children: [
                  'Save',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘S'],
                  },
                ],
              },
              {
                kind: 'box',
                attrs: { role: 'separator' },
                className: '-mx-1 my-1 h-px bg-border/50',
              },
              {
                kind: 'box',
                className: 'px-2 py-1 text-xs font-medium text-muted-foreground',
                children: ['Edit'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'cut', textValue: 'Cut' },
                children: [
                  'Cut',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘X'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: [
                  'Copy',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘C'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-context-menu-item',
                props: { value: 'paste', textValue: 'Paste' },
                children: [
                  'Paste',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    children: ['⌘V'],
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
