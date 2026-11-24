import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: (['default', 'none', 'md', 'full'] as const).map((radius) => ({
          kind: 'proto' as const,
          prototypeId: 'brutalist-surface-root',
          props: { variant: 'secondary', radius },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-bold',
              children: [`radius="${radius}"`],
            },
          ],
        })),
      },
      {
        kind: 'box',
        className: 'grid grid-cols-1 gap-3 sm:grid-cols-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'secondary', border: 'all' },
            children: [
              { kind: 'box', className: 'p-3 text-xs font-medium', children: ['border="all"'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'transparent', radius: 'none', border: 'bottom' },
            children: [
              { kind: 'box', className: 'p-3 text-xs font-medium', children: ['border="bottom"'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'muted', border: 'none' },
            children: [
              { kind: 'box', className: 'p-3 text-xs font-medium', children: ['border="none"'] },
            ],
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
                className: 'px-4 py-2 text-xs font-bold',
                children: ['Raised · rest (4px shadow)'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'solid', elevation: 'raised', pressed: true },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-2 text-xs font-bold',
                children: ['Raised · pressed (+4px snap)'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-surface-root',
            props: { variant: 'secondary', elevation: 'none', focusVisible: true },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-2 text-xs font-bold',
                children: ['Flat · focus ring'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
