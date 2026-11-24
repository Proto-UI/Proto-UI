import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid justify-items-start gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-menubar-root',
        props: { a11yLabel: 'Document actions' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-trigger',
            props: { value: 'file' },
            children: ['File'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-content',
            props: { value: 'file', a11yLabel: 'File actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'new-file', textValue: 'New File' },
                children: ['New File'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
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
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'save', textValue: 'Save' },
                children: ['Save'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-trigger',
            props: { value: 'more' },
            children: ['More'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-content',
            props: { value: 'more', a11yLabel: 'More actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
                props: { value: 'settings', textValue: 'Settings' },
                children: ['Settings'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-menubar-item',
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
                prototypeId: 'liquid-glass-menubar-item',
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
