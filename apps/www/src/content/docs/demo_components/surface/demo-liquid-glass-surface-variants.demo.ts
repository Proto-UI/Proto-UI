import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2',
    children: [
      {
        kind: 'box',
        className: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'outline' },
            children: [
              { kind: 'box', className: 'p-3 text-sm', children: ['outline (default 12px xl)'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'secondary' },
            children: [
              {
                kind: 'box',
                className: 'p-3 text-sm',
                children: ['secondary — Elevated card fill'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'muted', border: 'none' },
            children: [
              { kind: 'box', className: 'p-3 text-sm', children: ['muted — Soft grouping'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'accent' },
            children: [
              { kind: 'box', className: 'p-3 text-sm', children: ['accent — Neutral highlight'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'solid', border: 'none' },
            children: [
              {
                kind: 'box',
                className: 'p-3',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-text-root',
                    props: { tone: 'inherit', size: 'sm', weight: 'medium' },
                    children: ['solid — Prominent tint + inherited text'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'transparent', border: 'bottom', radius: 'none' },
            children: [
              {
                kind: 'box',
                className: 'p-3 text-sm',
                children: ['transparent · border="bottom"'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: (['default', 'none', 'sm', 'lg', 'full'] as const).map((radius) => ({
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-surface-root',
          props: { variant: 'secondary', radius },
          children: [
            {
              kind: 'box' as const,
              className: 'px-3 py-1.5 text-xs font-medium',
              children: [`radius="${radius}"`],
            },
          ],
        })),
      },
    ],
  },
} satisfies DemoSpec;
