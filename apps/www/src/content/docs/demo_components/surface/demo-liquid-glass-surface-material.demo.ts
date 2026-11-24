import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'grid w-full max-w-xl grid-cols-1 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'outline', material: 'auto', radius: 'xl', elevation: 'raised' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-2 p-1',
            children: [
              {
                kind: 'box',
                className: 'px-3 pt-2 text-xs font-semibold opacity-75',
                children: ['material="auto" · outline'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-surface-root',
                props: { variant: 'secondary', material: 'opaque', radius: 'lg', border: 'none' },
                children: [
                  {
                    kind: 'box',
                    className: 'p-3 text-xs',
                    children: ['Keep inner content opaque—never stack glass on glass.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'secondary', material: 'auto', radius: 'xl' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-medium',
                children: ['material="auto" · secondary'],
              },
              {
                kind: 'box',
                className: 'text-xs opacity-75',
                children: ['Requests regular glass optics with automatic contrast fallback.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'muted', material: 'auto', radius: 'xl' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-medium',
                children: ['material="auto" · muted'],
              },
              {
                kind: 'box',
                className: 'text-xs opacity-75',
                children: ['Eligible functional shell for compact bars and panels.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'outline', material: 'opaque', radius: 'xl' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-medium',
                children: ['material="opaque" (default)'],
              },
              {
                kind: 'box',
                className: 'text-xs opacity-75',
                children: ['Standard opaque card surface for primary reading content.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
