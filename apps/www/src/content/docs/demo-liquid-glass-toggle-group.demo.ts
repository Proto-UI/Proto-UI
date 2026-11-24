import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          multiple: true,
          defaultValue: ['bold'],
          a11yLabel: 'Text formatting',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'bold' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-bold-icon',
                className: 'inline-flex size-4 shrink-0 pointer-events-none',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle bold'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'italic' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-italic-icon',
                className: 'inline-flex size-4 shrink-0 pointer-events-none',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle italic'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'underline' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-underline-icon',
                className: 'inline-flex size-4 shrink-0 pointer-events-none',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Toggle underline'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
