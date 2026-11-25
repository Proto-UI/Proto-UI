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
          'flex flex-col gap-2.5 rounded-xl bg-background/75 p-4 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md',
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between',
            children: [
              { kind: 'box', tag: 'span', children: ['Item 1'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-muted-foreground',
                children: ['Value 1'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { decorative: false },
          },
          {
            kind: 'box',
            className: 'flex items-center justify-between',
            children: [
              { kind: 'box', tag: 'span', children: ['Item 2'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-muted-foreground',
                children: ['Value 2'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { decorative: false },
          },
          {
            kind: 'box',
            className: 'flex items-center justify-between',
            children: [
              { kind: 'box', tag: 'span', children: ['Item 3'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-muted-foreground',
                children: ['Value 3'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
