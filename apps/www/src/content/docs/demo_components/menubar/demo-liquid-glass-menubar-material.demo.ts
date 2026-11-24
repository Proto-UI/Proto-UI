import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid gap-5 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-2',
    children: [
      {
        kind: 'box',
        className: 'grid justify-items-start gap-2',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs font-medium text-foreground',
            children: ['material="auto" (default)'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-root',
            props: { a11yLabel: 'Glass menu' },
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
                props: { value: 'file', material: 'auto', a11yLabel: 'Glass file menu' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-menubar-item',
                    props: { value: 'new', textValue: 'New Window' },
                    children: ['New Window'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-menubar-item',
                    props: { value: 'share', textValue: 'Share' },
                    children: ['Share'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid justify-items-start gap-2',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'text-xs font-medium text-foreground',
            children: ['material="opaque"'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-menubar-root',
            props: { a11yLabel: 'Opaque menu' },
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
                props: { value: 'file', material: 'opaque', a11yLabel: 'Opaque file menu' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-menubar-item',
                    props: { value: 'new', textValue: 'New Window' },
                    children: ['New Window'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-menubar-item',
                    props: { value: 'share', textValue: 'Share' },
                    children: ['Share'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
