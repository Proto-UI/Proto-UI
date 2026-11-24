import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'outline', material: 'auto', radius: 'default', elevation: 'raised' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-2 p-1',
            children: [
              {
                kind: 'box',
                className: 'px-3 pt-2 text-xs font-semibold opacity-75',
                children: ['Floating Glass Shell (material="auto")'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-surface-root',
                props: { variant: 'secondary', material: 'opaque', radius: 'lg', border: 'none' },
                children: [
                  {
                    kind: 'box',
                    className: 'p-3 text-sm',
                    children: [
                      'Opaque content card nested with concentric corners (12px outer = 8px inner + 4px padding).',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'secondary', material: 'auto', radius: 'full' },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-1.5 text-sm font-medium',
                children: ['Glass Pill'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-surface-root',
            props: { variant: 'solid', material: 'opaque', radius: 'full' },
            children: [
              {
                kind: 'box',
                className: 'px-4 py-1.5 text-sm font-medium',
                children: ['Prominent Action'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
