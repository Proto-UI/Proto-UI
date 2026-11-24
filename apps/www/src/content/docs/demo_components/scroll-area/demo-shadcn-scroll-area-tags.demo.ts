import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const TAGS = Array.from({ length: 30 }, (_, index) => `v1.2.0-beta.${50 - index}`);

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-scroll-area-root',
        className: 'h-72 w-48 rounded-md border bg-background',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'p-4',
                children: [
                  {
                    kind: 'box',
                    className: 'mb-4 text-sm leading-none font-medium',
                    children: ['Tags'],
                  },
                  ...TAGS.flatMap((tag, index) => [
                    {
                      kind: 'box' as const,
                      className: 'text-sm',
                      children: [tag],
                    },
                    ...(index < TAGS.length - 1
                      ? [{ kind: 'box' as const, className: 'my-2 h-px w-full bg-border' }]
                      : []),
                  ]),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
});
