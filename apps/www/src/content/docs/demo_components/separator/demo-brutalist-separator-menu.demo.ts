import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center gap-3 text-sm md:gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: ['Settings'] },
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
        prototypeId: 'brutalist-separator-root',
        props: { orientation: 'vertical' },
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: ['Account'] },
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
        prototypeId: 'brutalist-separator-root',
        className: 'hidden md:block',
        props: { orientation: 'vertical' },
      },
      {
        kind: 'box',
        className: 'hidden flex-col gap-1 md:flex',
        children: [
          { kind: 'box', tag: 'span', className: 'font-bold', children: ['Help'] },
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
} satisfies DemoSpec;
