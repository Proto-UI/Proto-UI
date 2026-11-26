import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-md',
    children: [
      {
        kind: 'box',
        className:
          'flex flex-col gap-3 rounded-xl bg-background p-4 text-sm shadow-sm ring-1 ring-border',
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between',
            children: [
              { kind: 'box', tag: 'span', className: 'font-medium', children: ['Vibrancy'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs text-muted-foreground',
                children: ['material="auto"'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { material: 'auto' },
          },
          {
            kind: 'box',
            className: 'flex items-center justify-between',
            children: [
              { kind: 'box', tag: 'span', className: 'font-medium', children: ['Opaque'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs text-muted-foreground',
                children: ['material="opaque"'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { material: 'opaque' },
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: [
              'Opaque mode forces a solid hairline without translucency, matching Reduce Transparency.',
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
