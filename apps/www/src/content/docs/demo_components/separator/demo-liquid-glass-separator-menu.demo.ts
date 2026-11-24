import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className:
          'flex items-center gap-3 rounded-xl bg-background/75 px-4 py-3 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md md:gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1',
            children: [
              { kind: 'box', tag: 'span', className: 'font-medium', children: ['Settings'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs text-muted-foreground',
                children: ['Manage preferences'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            props: { orientation: 'vertical' },
          },
          {
            kind: 'box',
            className: 'flex flex-col gap-1',
            children: [
              { kind: 'box', tag: 'span', className: 'font-medium', children: ['Account'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs text-muted-foreground',
                children: ['Profile & security'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-separator-root',
            className: 'hidden md:block',
            props: { orientation: 'vertical' },
          },
          {
            kind: 'box',
            className: 'hidden flex-col gap-1 md:flex',
            children: [
              { kind: 'box', tag: 'span', className: 'font-medium', children: ['Help'] },
              {
                kind: 'box',
                tag: 'span',
                className: 'text-xs text-muted-foreground',
                children: ['Support & docs'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
