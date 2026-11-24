import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 grid justify-items-center gap-4',
    children: [
      {
        kind: 'box',
        className: 'grid justify-items-center gap-1.5',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Disabled root'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-root',
            props: { disabled: true, a11yLabel: 'Read-only actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-button',
                props: { value: 'undo' },
                children: ['Undo'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-button',
                props: { value: 'redo' },
                children: ['Redo'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-separator',
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-button',
                props: { value: 'publish', variant: 'prominent' },
                children: ['Publish'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid justify-items-center gap-1.5',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Non-looping navigation (loop={false})'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toolbar-root',
            props: { loop: false, a11yLabel: 'Bounded actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-button',
                props: { value: 'back' },
                children: ['Back'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-button',
                props: { value: 'forward', disabled: true },
                children: ['Forward'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-toolbar-button',
                props: { value: 'reload' },
                children: ['Reload'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
