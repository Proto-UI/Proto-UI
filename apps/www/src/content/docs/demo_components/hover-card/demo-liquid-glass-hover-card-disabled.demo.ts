import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 flex-wrap items-center justify-center gap-6 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-hover-card-root',
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-trigger',
            children: ['Active trigger'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 8 },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Enabled Preview'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Non-glass trigger avoids glass-on-glass stacking over the card.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-hover-card-root',
        props: { disabled: true, openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-trigger',
            children: ['Disabled trigger'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 8 },
            children: ['Disabled cards stay closed without reducing text legibility.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
