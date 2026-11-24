import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const PRINTS = [
  { artist: 'Ornella Binni', edition: 'Print 01', swatch: 'bg-[#5294ff]' },
  { artist: 'Tom Byrom', edition: 'Print 02', swatch: 'bg-[#facc00]' },
  { artist: 'Vladimir Malyavko', edition: 'Print 03', swatch: 'bg-[#05e17a]' },
  { artist: 'Clara Lindqvist', edition: 'Print 04', swatch: 'bg-[#ff4d50]' },
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-96',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-scroll-area-root',
        className: 'w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-max gap-4 p-4 pb-7',
                children: PRINTS.map((item) => ({
                  kind: 'box' as const,
                  className: 'shrink-0',
                  children: [
                    {
                      kind: 'box' as const,
                      className: `flex h-36 w-32 flex-col justify-between rounded-[5px] border-2 border-black ${item.swatch} p-3 text-black`,
                      children: [
                        {
                          kind: 'box' as const,
                          className: 'font-mono text-xs font-bold',
                          children: [item.edition],
                        },
                        {
                          kind: 'box' as const,
                          className: 'text-sm font-bold',
                          children: [item.artist],
                        },
                      ],
                    },
                    {
                      kind: 'box' as const,
                      className: 'pt-2 text-xs',
                      children: [`Photo by ${item.artist}`],
                    },
                  ],
                })),
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-scrollbar',
            ref: 'scrollbarHorizontal',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-scroll-area-thumb',
                ref: 'thumbHorizontal',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
