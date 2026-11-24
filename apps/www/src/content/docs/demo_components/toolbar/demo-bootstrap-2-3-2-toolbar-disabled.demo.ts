import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid justify-items-center gap-4 p-4',
    children: [
      {
        kind: 'box',
        className: 'grid justify-items-center gap-1',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Disabled root'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-root',
            props: { disabled: true, a11yLabel: 'Read-only actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-button',
                props: { value: 'undo' },
                children: ['Undo'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-button',
                props: { value: 'redo' },
                children: ['Redo'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-separator',
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-button',
                props: { value: 'save', variant: 'primary' },
                children: ['Save'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid justify-items-center gap-1',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs text-muted-foreground',
            children: ['Non-looping navigation (loop={false})'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toolbar-root',
            props: { loop: false, a11yLabel: 'Bounded actions' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-button',
                props: { value: 'back' },
                children: ['Back'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-button',
                props: { value: 'forward', disabled: true },
                children: ['Forward'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toolbar-button',
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
