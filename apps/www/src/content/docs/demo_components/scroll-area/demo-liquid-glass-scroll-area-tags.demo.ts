import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const BUILDS = Array.from({ length: 24 }, (_, index) => `26.0 Beta ${24 - index}`);

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-scroll-area-root',
        className: 'h-64 w-52 rounded-xl border border-border/60 bg-background/90 shadow-sm',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'p-4',
                children: [
                  {
                    kind: 'box',
                    className: 'mb-3 text-sm font-semibold',
                    children: ['Builds'],
                  },
                  ...BUILDS.flatMap((build, index) => [
                    {
                      kind: 'box' as const,
                      className: 'text-sm',
                      children: [build],
                    },
                    ...(index < BUILDS.length - 1
                      ? [{ kind: 'box' as const, className: 'my-2 h-px w-full bg-border/60' }]
                      : []),
                  ]),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
