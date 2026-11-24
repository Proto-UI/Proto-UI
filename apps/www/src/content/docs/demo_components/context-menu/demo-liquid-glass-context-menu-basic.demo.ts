import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
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
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'back', textValue: 'Back' },
                children: ['Back'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'forward', textValue: 'Forward', disabled: true },
                children: ['Forward'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'reload', textValue: 'Reload' },
                children: ['Reload'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
