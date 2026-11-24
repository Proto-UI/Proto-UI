import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-xl grid-cols-1 gap-3 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'outline' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-medium',
            children: ['outline — Canvas frame'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'secondary' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-medium',
            children: ['secondary — Neutral panel'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'muted' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-medium',
            children: ['muted — Subtle container'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'accent' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-bold',
            children: ['accent — Canary highlight'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'solid' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-bold',
            children: ['solid — Primary main fill'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'transparent' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-sm font-medium',
            children: ['transparent — Open shell'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        className: 'sm:col-span-2',
        props: { variant: 'scrim', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'p-3 text-xs font-bold text-white',
            children: ['scrim — 80% black modal backdrop'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
