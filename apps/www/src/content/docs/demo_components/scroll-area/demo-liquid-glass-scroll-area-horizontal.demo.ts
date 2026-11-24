import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const SCENES = [
  { name: 'Big Sur Mist', credit: 'Ornella Binni', gradient: 'from-sky-400/70 to-indigo-500/70' },
  { name: 'Glacier Glass', credit: 'Tom Byrom', gradient: 'from-cyan-400/70 to-teal-500/70' },
  {
    name: 'Aurora Drift',
    credit: 'Vladimir Malyavko',
    gradient: 'from-fuchsia-400/70 to-violet-500/70',
  },
  {
    name: 'Solstice Glow',
    credit: 'Clara Lindqvist',
    gradient: 'from-amber-400/70 to-rose-500/70',
  },
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-scroll-area-root',
        className: 'w-full rounded-xl border border-border/60 bg-background/90 shadow-sm',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-max gap-3.5 p-4',
                children: SCENES.map((scene) => ({
                  kind: 'box' as const,
                  className: 'shrink-0',
                  children: [
                    {
                      kind: 'box' as const,
                      className: `flex h-36 w-32 flex-col justify-end rounded-lg bg-gradient-to-br ${scene.gradient} p-3 text-white`,
                      children: [
                        {
                          kind: 'box' as const,
                          className: 'text-xs font-semibold',
                          children: [scene.name],
                        },
                      ],
                    },
                    {
                      kind: 'box' as const,
                      className: 'pt-2 text-xs text-muted-foreground',
                      children: [scene.credit],
                    },
                  ],
                })),
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
