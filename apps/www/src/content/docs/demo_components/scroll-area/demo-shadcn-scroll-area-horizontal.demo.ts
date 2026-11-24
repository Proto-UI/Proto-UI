import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const ARTWORKS = [
  {
    artist: 'Ornella Binni',
    title: 'Alpine Dawn',
    palette: 'from-amber-200 via-rose-200 to-indigo-300',
  },
  {
    artist: 'Tom Byrom',
    title: 'Coastal Fog',
    palette: 'from-sky-200 via-cyan-200 to-teal-300',
  },
  {
    artist: 'Vladimir Malyavko',
    title: 'Dusk Ridge',
    palette: 'from-violet-200 via-fuchsia-200 to-orange-200',
  },
  {
    artist: 'Clara Lindqvist',
    title: 'Nordic Pine',
    palette: 'from-emerald-200 via-teal-200 to-sky-300',
  },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-96',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-scroll-area-root',
        className: 'w-full rounded-md border bg-background whitespace-nowrap',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-max gap-4 p-4',
                children: ARTWORKS.map((work) => ({
                  kind: 'box' as const,
                  className: 'shrink-0',
                  children: [
                    {
                      kind: 'box' as const,
                      className: `flex h-40 w-32 flex-col justify-end rounded-md bg-gradient-to-br ${work.palette} p-3 text-slate-900`,
                      children: [
                        {
                          kind: 'box' as const,
                          className: 'text-xs font-semibold',
                          children: [work.title],
                        },
                      ],
                    },
                    {
                      kind: 'box' as const,
                      className: 'pt-2 text-xs text-muted-foreground',
                      children: [
                        'Photo by ',
                        {
                          kind: 'box' as const,
                          tag: 'span' as const,
                          className: 'font-semibold text-foreground',
                          children: [work.artist],
                        },
                      ],
                    },
                  ],
                })),
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
});
