import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-80',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-scroll-area-root',
        className: 'h-48 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-3 p-4 pr-7 text-sm leading-relaxed',
                children: [
                  {
                    kind: 'box',
                    className: 'font-heading text-base font-bold',
                    children: ['The Castle Chronicle'],
                  },
                  {
                    kind: 'box',
                    children: [
                      "Jokester began sneaking into the castle in the middle of the night and leaving jokes all over the place: under the king's pillow, in his soup, even in the royal chambers.",
                    ],
                  },
                  {
                    kind: 'box',
                    children: [
                      "The king was furious, but he couldn't seem to stop Jokester. Every morning another handwritten pun waited beside the crown.",
                    ],
                  },
                  {
                    kind: 'box',
                    children: [
                      "And then, one day, the people of the kingdom discovered that the jokes left by Jokester were so funny that they couldn't help but laugh—and once they started laughing, they couldn't stop.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-scrollbar',
            ref: 'scrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-scroll-area-thumb',
                ref: 'thumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
