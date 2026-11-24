import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-lg flex-col gap-4 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'outline', radius: 'default' },
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-4 p-4',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-0.5',
                children: [
                  { kind: 'box', className: 'text-sm font-bold', children: ['Project Overview'] },
                  {
                    kind: 'box',
                    className: 'text-xs opacity-80',
                    children: ['5px rounded-base corners with 2px frame border.'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-surface-root',
                props: { variant: 'accent', radius: 'default' },
                children: [
                  {
                    kind: 'box',
                    className: 'px-2.5 py-0.5 text-xs font-bold',
                    children: ['Beta'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-surface-root',
        props: { variant: 'secondary', radius: 'default' },
        children: [
          {
            kind: 'box',
            className: 'p-4 text-sm font-medium',
            children: ['Secondary panel with crisp neutral canvas fill.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'solid', elevation: 'raised' },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-2 text-sm font-bold',
                children: ['Raised Action'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'accent', elevation: 'raised', pressed: true },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-2 text-sm font-bold',
                children: ['Pressed Snap'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
