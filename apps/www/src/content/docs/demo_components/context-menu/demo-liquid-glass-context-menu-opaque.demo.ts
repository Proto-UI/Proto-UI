import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md grid-cols-2 gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-context-menu-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-context-menu-trigger',
            className: 'h-32 w-full border-dashed bg-secondary/70',
            children: ['Auto (Liquid Glass)'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-context-menu-content',
            props: { material: 'auto' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: ['Copy'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'paste', textValue: 'Paste' },
                children: ['Paste'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-context-menu-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-context-menu-trigger',
            className: 'h-32 w-full border-dashed bg-secondary/70',
            children: ['Opaque surface'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-context-menu-content',
            props: { material: 'opaque' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'copy', textValue: 'Copy' },
                children: ['Copy'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-context-menu-item',
                props: { value: 'paste', textValue: 'Paste' },
                children: ['Paste'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
