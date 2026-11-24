import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-start gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-menubar-root',
        props: { a11yLabel: 'Document actions' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'file' },
            children: ['File'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'file', a11yLabel: 'File actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'new-file', textValue: 'New File' },
                children: [
                  'New File',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘N'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'open-folder', textValue: 'Open Folder' },
                children: ['Open Folder'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'save', textValue: 'Save' },
                children: [
                  'Save',
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'ml-auto text-xs tracking-widest text-muted-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['⌘S'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'more' },
            children: ['More'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'more', a11yLabel: 'More actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'settings', textValue: 'Settings' },
                children: ['Settings'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'help', textValue: 'Help' },
                children: ['Help'],
              },
              {
                kind: 'box',
                className: '-mx-1 my-1 h-px bg-border',
                attrs: { role: 'separator' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'delete', textValue: 'Delete', variant: 'destructive' },
                children: ['Delete'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
